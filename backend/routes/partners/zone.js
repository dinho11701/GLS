// backend/routes/partners/zone.js
const express = require('express');
const { db } = require('../../config/firebase');

const router = express.Router();

/**
 * GET /api/v1/partners/zone
 * Retourne la zone du partenaire courant (req.user.uid)
 */
router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(400).json({ ok: false, error: 'missing_uid' });
    }

    const snap = await db.collection('partnerZones').doc(uid).get();
    if (!snap.exists) {
      return res.status(404).json({
        ok: false,
        error: 'zone_not_found',
        message: "Aucune zone définie pour ce partenaire.",
      });
    }

    const data = snap.data();
    // On renvoie les champs comme attendus par le front (center, radiusKm, available, address, partnerId, updatedAt)
    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[ZONE] GET error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * POST /api/v1/partners/zone
 * Body: { center: {latitude, longitude}, radiusKm, available, address }
 */
router.post('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(400).json({ ok: false, error: 'missing_uid' });
    }

    const {
      center,
      radiusKm = 5,
      available = true,
      address = '',
    } = req.body || {};

    if (
      !center ||
      typeof center.latitude !== 'number' ||
      typeof center.longitude !== 'number'
    ) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_center',
        message: 'center.latitude et center.longitude sont requis.',
      });
    }

    const payload = {
      partnerId: uid,
      center: {
        latitude: center.latitude,
        longitude: center.longitude,
      },
      radiusKm: Number(radiusKm) || 5,
      available: Boolean(available),
      address: String(address || ''),
      updatedAt: new Date().toISOString(),
    };

    console.log('[ZONE] upsert for partner', uid, payload);

    await db.collection('partnerZones').doc(uid).set(payload, { merge: true });

    return res.json({ ok: true, ...payload });
  } catch (err) {
    console.error('[ZONE] POST error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

module.exports = router;
