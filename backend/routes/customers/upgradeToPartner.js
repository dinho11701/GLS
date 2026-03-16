// backend/routes/customers/upgradeToPartner.js
const express = require('express');
const authGuard = require('../../middleware/authGuard');
const { db, admin } = require('../../config/firebase');

const router = express.Router();

router.post('/upgrade-to-partner', authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || req.user?.claims?.email || null;

    if (!uid) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const now = new Date();

    /* ---------------------------------------------------------
       1) CUSTOMER — créer ou mettre à jour + rôle = partner
    --------------------------------------------------------- */
    const customerRef = db.collection('customers').doc(uid);
    const customerSnap = await customerRef.get().catch(() => null);
    let customerData = customerSnap?.exists ? customerSnap.data() : null;

    if (!customerData) {
      customerData = {
        userId: uid,
        email,
        role: "partner",      // 🔥 OBLIGATOIRE
        type: "partner",      // 🔥 OBLIGATOIRE
        createdAt: now,
        updatedAt: now,
        fromUpgrade: true,
      };
    }

    // Mise à jour obligatoire du rôle
    await customerRef.set(
      {
        email: customerData.email || email || null,
        role: "partner",       // 🔥 IMPORTANT
        type: "partner",       // 🔥 IMPORTANT
        updatedAt: now,
      },
      { merge: true }
    );

    /* ---------------------------------------------------------
       2) PARTNER — créer ou mettre à jour + rôle = partner
    --------------------------------------------------------- */
    const partnerRef = db.collection('partners').doc(uid);
    const partnerSnap = await partnerRef.get().catch(() => null);

    const displayName =
      customerData.displayName ||
      customerData.name ||
      req.user?.name ||
      "Nouveau partenaire";

    let alreadyPartner = false;

    if (!partnerSnap?.exists) {
      await partnerRef.set(
        {
          uid,
          email: customerData.email || email || null,
          displayName,
          ownerUid: uid,
          status: "active",
          role: "partner",       // 🔥 AJOUT
          createdAt: now,
          updatedAt: now,
          fromCustomerUpgrade: true,
        },
        { merge: true }
      );
    } else {
      alreadyPartner = true;
      await partnerRef.set(
        {
          email: partnerSnap.data().email || customerData.email || email || null,
          displayName: partnerSnap.data().displayName || displayName,
          role: "partner",       // 🔥 AJOUT
          updatedAt: now,
        },
        { merge: true }
      );
    }

    /* ---------------------------------------------------------
       3) FIREBASE CUSTOM CLAIMS
    --------------------------------------------------------- */
    let mustRefreshToken = false;

    try {
      const record = await admin.auth().getUser(uid);
      const currentClaims = record.customClaims || {};

      const nextClaims = {
        ...currentClaims,
        isPartner: true,
        role: "partner",     // 🔥 UNIFORMISATION
      };

      await admin.auth().setCustomUserClaims(uid, nextClaims);
      mustRefreshToken = true;
    } catch (e) {
      console.warn('[UPGRADE_TO_PARTNER][CLAIMS][WARN]', e.message || e);
    }

    /* ---------------------------------------------------------
       4) RÉPONSE FINALE
    --------------------------------------------------------- */
    return res.status(alreadyPartner ? 409 : 200).json({
      ok: true,
      uid,
      partnerId: partnerRef.id,
      mustRefreshToken,
      message: alreadyPartner
        ? "Utilisateur déjà partenaire."
        : "Utilisateur promu au rôle partenaire.",
    });

  } catch (e) {
    console.error("[UPGRADE_TO_PARTNER][ERROR]", e);
    return res.status(500).json({
      error: "Erreur lors de la mise à niveau.",
    });
  }
});

module.exports = router;
