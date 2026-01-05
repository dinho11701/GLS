// routes/customers/payments.js
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');
const Stripe = require('stripe');

const router = express.Router();

/* --- Guard: clé Stripe --- */
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[payments] STRIPE_SECRET_KEY manquante (mode test recommandé: sk_test_...)');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing', {
  apiVersion: '2024-06-20',
});

/* --- Ping simple --- */
router.get('/_ping', (_req, res) => res.json({ ok: true, scope: 'customers-payments' }));

/* --- Helpers --- */
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
}
function normalizeContractPayload(p) {
  return {
    contrat_ID: p.contrat_ID,
    date_ID: p.date_ID,
    Client_ID: p.Client_ID,
    Partenaire_ID: p.Partenaire_ID,
    Service_ID: p.Service_ID,
    Location: p.Location || null,
    Payment_methode: p.Payment_methode || 'card',
  };
}

/* --- Créer PaymentIntent + Contract --- */
router.post(
  '/intents',
  authGuard,
  [
    body('amount').isInt({ min: 50 }),
    body('currency').isString().isLength({ min: 3, max: 3 }),
    body('Partenaire_ID').isString().notEmpty(),
    body('Service_ID').isString().notEmpty(),
    body('Location').optional(),
    body('Payment_methode').optional().isString(),
    body('contrat_ID').optional().isString(),
    body('date_ID').optional().isInt(),
    body('description').optional().isString(),
  ],
  async (req, res) => {
    const v = handleValidation(req, res);
    if (v) return v;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquante)' });
    }

    try {
      const {
        amount,
        currency,
        Partenaire_ID,
        Service_ID,
        Location,
        Payment_methode = 'card',
        contrat_ID,
        date_ID,
        description,
        idempotencyKey,
      } = req.body;

      const Client_ID = req.user.uid;

      const pi = await stripe.paymentIntents.create(
  {
    amount: Number(amount),
    currency: String(currency).toLowerCase(),
    description: description || `Service ${Service_ID} (Partner ${Partenaire_ID})`,
    metadata: { Client_ID, Partenaire_ID, Service_ID },
    // ✅ Autoriser les moyens automatiques MAIS sans redirections (Klarna/Link, etc.)
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  },
  idempotencyKey ? { idempotencyKey } : undefined
);


      const contractsCol = db.collection('contracts');
      const paymentsCol = db.collection('payments');

      const contractDocRef = contractsCol.doc(contrat_ID || pi.id);
      const now = new Date();
      const yyyymmdd = Number(
        `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      );

      const contractData = normalizeContractPayload({
        contrat_ID: contractDocRef.id,
        date_ID: date_ID || yyyymmdd,
        Client_ID,
        Partenaire_ID,
        Service_ID,
        Location,
        Payment_methode,
      });

      const batch = db.batch();

      batch.set(contractDocRef, {
        ...contractData,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
        stripe_payment_intent_id: pi.id,
        currency: String(currency).toUpperCase(),
        amount: Number(amount),
      });

      const paymentDocRef = paymentsCol.doc(pi.id);
      batch.set(paymentDocRef, {
        id: pi.id,
        clientId: Client_ID,
        partnerId: Partenaire_ID,
        serviceId: Service_ID,
        amount: Number(amount),
        currency: String(currency).toUpperCase(),
        status: pi.status,
        latest_charge: pi.latest_charge || null,
        payment_method_types: pi.payment_method_types || null,
        createdAt: now,
        updatedAt: now,
        contractId: contractDocRef.id,
      });

      await batch.commit();


/* ---------------------------------------------------------
   ⭐ AJOUT NOTIFICATION : Paiement lancé
--------------------------------------------------------- */
try {
  await db
    .collection("customers")
    .doc(Client_ID)
    .collection("notifs")
    .doc()
    .set({
      type: "payment",
      title: "Paiement en cours",
      body: `Votre paiement pour le service ${Service_ID} est en cours.`,
      data: {
        paymentIntentId: pi.id,
        contractId: contractDocRef.id,
      },
      status: "unread",
      createdAt: new Date(),
      readAt: null,
    });
} catch (err) {
  console.error("[PAYMENTS][NOTIF_CREATE][ERROR]", err);
}




      return res.status(201).json({
        contract: { id: contractDocRef.id, ...contractData },
        payment_intent: {
          id: pi.id,
          client_secret: pi.client_secret,
          status: pi.status,
          amount: pi.amount,
          currency: pi.currency,
        },
      });
    } catch (err) {
      console.error('[PAYMENTS][INTENTS][ERROR]', err);
      return res.status(500).json({ error: 'Unable to create payment intent.' });
    }
  }
);

/* --- Historique --- */
router.get(
  '/history',
  authGuard,
  [
    query('partnerId').optional().isString(),
    query('serviceId').optional().isString(),
    query('status').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  async (req, res) => {
    const v = handleValidation(req, res);
    if (v) return v;

    try {
      const clientId = req.user.uid;
      const { partnerId, serviceId, status } = req.query;
      const limit = Number(req.query.limit || 20);

      let q = db.collection('payments').where('clientId', '==', clientId);
      if (partnerId) q = q.where('partnerId', '==', partnerId);
      if (serviceId) q = q.where('serviceId', '==', serviceId);
      if (status) q = q.where('status', '==', status);

      const snap = await q.orderBy('createdAt', 'desc').limit(limit).get();

      const payments = [];
      snap.forEach((doc) => payments.push({ id: doc.id, ...doc.data() }));

      return res.json({ payments });
    } catch (err) {
      console.error('[PAYMENTS][HISTORY][ERROR]', err);
      return res.status(500).json({ error: 'Unable to fetch payment history.' });
    }
  }
);

/* --- Get Contract --- */
router.get('/contracts/:id', authGuard, async (req, res) => {
  try {
    const doc = await db.collection('contracts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Contract not found' });

    const data = doc.data();
    if (data.Client_ID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ contract: { id: doc.id, ...data } });
  } catch (err) {
    console.error('[PAYMENTS][CONTRACTS][GET][ERROR]', err);
    return res.status(500).json({ error: 'Unable to fetch contract.' });
  }
});

/* --- Dev-only: confirmer un intent pour tests Postman --- */
router.post('/intents/:id/confirm', authGuard, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not allowed in production' });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe non configuré' });
    }
    const id = req.params.id;
    const confirmed = await stripe.paymentIntents.confirm(id, {
      payment_method: 'pm_card_visa', // carte test succès
    });

    // maj Firestore rapide
    await db.collection('payments').doc(id).set(
      {
        status: confirmed.status,
        latest_charge: confirmed.latest_charge || null,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    if (confirmed.status === 'succeeded') {
      await db.collection('contracts').doc(confirmed.id).set(
        { status: 'paid', updatedAt: new Date() },
        { merge: true }
      );
    }


if (confirmed.status === 'succeeded') {
  try {
    const paymentDoc = await db.collection('payments').doc(confirmed.id).get();
    const p = paymentDoc.data();

    await db
      .collection("customers")
      .doc(p.clientId)
      .collection("notifs")
      .doc()
      .set({
        type: "payment_success",
        title: "Paiement réussi",
        body: `Votre paiement de ${(p.amount/100).toFixed(2)} ${p.currency} a été confirmé.`,
        data: {
          paymentIntentId: confirmed.id,
          contractId: p.contractId,
        },
        status: "unread",
        createdAt: new Date(),
        readAt: null,
      });
  } catch (e) {
    console.error("[PAYMENTS][NOTIF_SUCCESS][ERROR]", e);
  }
}



    return res.json({ payment_intent: confirmed });
  } catch (err) {
    console.error('[PAYMENTS][INTENTS_CONFIRM][ERROR]', err);
    return res.status(500).json({ error: 'Unable to confirm payment intent.' });
  }
});

module.exports = router;
