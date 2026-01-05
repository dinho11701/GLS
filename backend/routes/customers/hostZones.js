// backend/routes/customers/hostZones.js
const express = require('express');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();

/**
 * GET /api/v1/customers/host-zones
 * Retourne les zones des partenaires disponibles
 * - available = true : l’hôte est globalement actif
 * - instantAvailable = true (optionnel) : dispo immédiate si ?immediateOnly=true
 *
 * Utilisé par le client pour filtrer les services visibles sur la carte.
 */
router.get('/host-zones', authGuard, async (req, res) => {
  try {
    const { immediateOnly } = req.query;

    // Base : hôtes activés
    let ref = db
      .collection('partnerZones')
      .where('available', '==', true);

    // Si le client demande explicitement la dispo immédiate
    if (immediateOnly === 'true') {
      ref = ref.where('instantAvailable', '==', true);
    }

    const snap = await ref.get();

    const items = snap.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        partnerId: data.partnerId || doc.id,
        center: data.center || null,
        radiusKm: data.radiusKm ?? null,
        available: !!data.available,
        instantAvailable: !!data.instantAvailable, // 👈 nouveau champ renvoyé
        address: data.address || null,
        updatedAt: data.updatedAt || null,
      };
    });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /customers/host-zones error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

module.exports = router;
