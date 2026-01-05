// backend/routes/customers/upgradeToPartner.js
const express = require('express');
const authGuard = require('../../middleware/authGuard');
const { db, admin } = require('../../config/firebase');

const router = express.Router();

/**
 * POST /api/v1/customers/upgrade-to-partner
 */
router.post('/upgrade-to-partner', authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const email =
      req.user?.email ||
      req.user?.claims?.email ||
      null;

    if (!uid) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const now = new Date();

    // 1) Customer : doc minimal si inexistant
    const customerRef  = db.collection('customers').doc(uid);
    const customerSnap = await customerRef.get().catch(() => null);

    let customerData = customerSnap && customerSnap.exists ? customerSnap.data() : null;

    if (!customerData) {
      customerData = {
        userId: uid,
        email,
        createdAt: now,
        updatedAt: now,
        fromUpgrade: true,
      };
      await customerRef.set(customerData, { merge: true });
    } else {
      await customerRef.set(
        {
          email: customerData.email || email || null,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    // 2) Partner
    const partnerRef  = db.collection('partners').doc(uid);
    const partnerSnap = await partnerRef.get().catch(() => null);

    const displayName =
      customerData.displayName ||
      customerData.name ||
      req.user?.name ||
      'Nouveau partenaire';

    let alreadyPartner = false;

    if (!partnerSnap || !partnerSnap.exists) {
      await partnerRef.set(
        {
          uid,
          email: customerData.email || email || null,
          displayName,
          ownerUid: uid,
          status: 'active',
          fromCustomerUpgrade: true,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      alreadyPartner = true;
      await partnerRef.set(
        {
          email: partnerSnap.data().email || customerData.email || email || null,
          displayName: partnerSnap.data().displayName || displayName,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    // 3) Claims Firebase : isPartner:true
    try {
      const userRecord   = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};
      const nextClaims    = {
        ...currentClaims,
        isPartner: true,
        role: currentClaims.role || 'partner',
      };

      await admin.auth().setCustomUserClaims(uid, nextClaims);
    } catch (e) {
      console.warn('[UPGRADE_TO_PARTNER][CLAIMS][WARN]', e.message || e);
    }

    const payload = {
      ok: true,
      uid,
      partnerId: partnerRef.id,
      message: alreadyPartner
        ? 'Utilisateur déjà partenaire.'
        : 'Utilisateur promu au rôle partenaire.',
    };

    // Si déjà partenaire → 409 (que ton frontend accepte comme "OK")
    return res.status(alreadyPartner ? 409 : 200).json(payload);
  } catch (e) {
    console.error('[UPGRADE_TO_PARTNER][ERROR]', e);
    return res.status(500).json({
      error: 'Erreur serveur lors de la mise à niveau en partenaire.',
    });
  }
});

module.exports = router;
