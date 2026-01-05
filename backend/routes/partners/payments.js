// routes/partners/payments.js
const express = require('express');
const { query, validationResult } = require('express-validator');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');
const Stripe = require('stripe');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing', {
  apiVersion: '2024-06-20',
});

/* Helpers */
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
}
function parseDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

// 🔑 Récupère les clés possibles du partenaire connecté : UID + éventuel slug/handle
// 1) depuis partners/{uid} (slug/handle/username/…)
// 2) si rien trouvé : depuis services (createdBy==uid ou partnerUid==uid) → partnerSlug/partnerId/partenaire_ID/…
async function getPartnerKeys(uid) {
  const keys = new Set([uid]);

  try {
    const pSnap = await db.collection('partners').doc(uid).get();
    if (pSnap.exists) {
      const p = pSnap.data() || {};
      const candidates = [p.slug, p.handle, p.username, p.publicId, p.partnerId, p.code];
      for (const c of candidates) if (c && typeof c === 'string') keys.add(c);
    }
  } catch (_) {}

  if (keys.size === 1) {
    try {
      const svcQ1 = db.collection('services').where('createdBy', '==', uid).limit(5);
      const svcQ2 = db.collection('services').where('partnerUid', '==', uid).limit(5);
      const [s1, s2] = await Promise.all([svcQ1.get(), svcQ2.get()]);
      const addFromServiceDoc = (doc) => {
        const s = doc.data() || {};
        const cands = [s.partnerSlug, s.partnerId, s.partenaire_ID, s.slug, s.handle];
        for (const c of cands) if (c && typeof c === 'string') keys.add(c);
      };
      s1.forEach(addFromServiceDoc);
      s2.forEach(addFromServiceDoc);
    } catch (_) {}
  }

  return Array.from(keys);
}

/**
 * GET /api/v1/partners/payments/_ping
 */
router.get('/_ping', (_req, res) => res.json({ ok: true, scope: 'partners-payments' }));

/**
 * GET /api/v1/partners/payments/billing/summary
 * - Résumé facturation (Firestore 'payments')
 * Query: from? (YYYY-MM-DD), to? (YYYY-MM-DD), limit? (échantillon)
 */
router.get(
  '/billing/summary',
  authGuard,
  [
    query('from').optional().isISO8601().withMessage('from must be YYYY-MM-DD'),
    query('to').optional().isISO8601().withMessage('to must be YYYY-MM-DD'),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res) => {
    const v = handleValidation(req, res); if (v) return v;

    try {
      const userUid = req.user?.uid;
      if (!userUid) return res.status(403).json({ error: 'Forbidden' });

      const from = parseDate(req.query.from);
      const toInc = parseDate(req.query.to);
      const to = toInc ? new Date(toInc.getFullYear(), toInc.getMonth(), toInc.getDate(), 23, 59, 59, 999) : null;
      const sampleLimit = Number(req.query.limit || 10);

      // Clés candidates (UID + slug/handle éventuel)
      const searchKeys = await getPartnerKeys(userUid);

      // Exécute la requête avec bornes de dates si possible, sinon fallback sans dates (index en build)
      const execWithDatesOrFallback = async (q) => {
        try {
          let qq = q;
          if (from) qq = qq.where('createdAt', '>=', from);
          if (to)   qq = qq.where('createdAt', '<=', to);
          return await qq.get();
        } catch (e) {
          if (String(e?.code) === '9' || /FAILED_PRECONDITION/i.test(e?.message || '')) {
            console.warn('[BILLING][SUMMARY] Fallback sans filtre date (index manquant/en build)');
            return await q.get();
          }
          throw e;
        }
      };

      // Pour chaque clé, on cherche par slug (partnerId) et par UID (partnerUid)
      const snaps = [];
      for (const key of searchKeys) {
        const bySlug = db.collection('payments').where('partnerId', '==', key).where('status', '==', 'succeeded');
        const byUid  = db.collection('payments').where('partnerUid', '==', key).where('status', '==', 'succeeded');
        const [s1, s2] = await Promise.all([execWithDatesOrFallback(bySlug), execWithDatesOrFallback(byUid)]);
        snaps.push(s1, s2);
      }

      // Fusion sans doublons
      const seen = new Set();
      const docs = [];
      for (const snap of snaps) {
        snap.forEach((doc) => {
          if (!seen.has(doc.id)) {
            seen.add(doc.id);
            docs.push({ id: doc.id, data: doc.data() });
          }
        });
      }

      // Agrégation + filtre en mémoire (sécurité si fallback)
      let totalAmount = 0;
      let count = 0;
      const journal = {}; // yyyy-mm-dd -> { date, count, amount }
      const sample = [];

      for (const { id, data: d } of docs) {
        const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0);
        if (from && ts < from) continue;
        if (to && ts > to) continue;

        count += 1;
        totalAmount += Number(d.amount || 0);

        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}`;
        journal[key] = journal[key] || { date: key, count: 0, amount: 0 };
        journal[key].count += 1;
        journal[key].amount += Number(d.amount || 0);

        if (sample.length < sampleLimit) {
          sample.push({
            id,
            serviceId: d.serviceId,
            clientId: d.clientId,
            amount: d.amount,
            currency: d.currency,
            createdAt: d.createdAt,
            status: d.status,
          });
        }
      }

      const journalByDay = Object.values(journal).sort((a, b) => (a.date < b.date ? 1 : -1));

      return res.json({
        totals: {
          count,
          amount: totalAmount,
          currency: count > 0 ? (sample[0]?.currency || 'CAD') : 'CAD',
        },
        journalByDay,
        sample,
        filters: {
          from: from ? from.toISOString().slice(0,10) : null,
          to: to ? to.toISOString().slice(0,10) : null,
          keysUsed: searchKeys,
        },
      });
    } catch (err) {
      console.error('[PARTNERS][BILLING][SUMMARY][ERROR]', err);
      return res.status(500).json({ error: 'Unable to fetch billing summary.' });
    }
  }
);

/**
 * GET /api/v1/partners/payments/payouts/overview
 */
router.get(
  '/payouts/overview',
  authGuard,
  [ query('limit').optional().isInt({ min: 1, max: 50 }) ],
  async (req, res) => {
    const v = handleValidation(req, res); if (v) return v;

    try {
      const partnerId = req.user?.uid;
      if (!partnerId) return res.status(403).json({ error: 'Forbidden' });

      const partnerDoc = await db.collection('partners').doc(partnerId).get();
      if (!partnerDoc.exists) return res.status(404).json({ error: 'Partner not found' });

      const { stripe_account_id: acct } = partnerDoc.data() || {};
      if (!acct) {
        return res.json({
          connect: { connected: false },
          message: 'No connected Stripe account (stripe_account_id missing). Billing summary is still available.',
        });
      }

      const limit = Number(req.query.limit || 10);
      const balance = await stripe.balance.retrieve({ stripeAccount: acct });
      const payouts = await stripe.payouts.list({ limit }, { stripeAccount: acct });

      return res.json({
        connect: { connected: true, account: acct },
        balance,
        payouts: payouts.data,
      });
    } catch (err) {
      console.error('[PARTNERS][PAYOUTS][OVERVIEW][ERROR]', err);
      return res.status(500).json({ error: 'Unable to fetch payouts overview.' });
    }
  }
);

/**
 * GET /api/v1/partners/payments/payouts/:id
 */
router.get('/payouts/:id', authGuard, async (req, res) => {
  try {
    const partnerId = req.user?.uid;
    if (!partnerId) return res.status(403).json({ error: 'Forbidden' });

    const partnerDoc = await db.collection('partners').doc(partnerId).get();
    if (!partnerDoc.exists) return res.status(404).json({ error: 'Partner not found' });

    const { stripe_account_id: acct } = partnerDoc.data() || {};
    if (!acct) return res.status(400).json({ error: 'No connected Stripe account' });

    const payout = await stripe.payouts.retrieve(req.params.id, { stripeAccount: acct });
    return res.json({ payout });
  } catch (err) {
    console.error('[PARTNERS][PAYOUTS][GET][ERROR]', err);
    return res.status(500).json({ error: 'Unable to fetch payout.' });
  }
});

module.exports = router;
