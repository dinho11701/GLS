// routes/customers/partnerDirectory.js
const express = require('express');
const { query } = require('express-validator');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();
const foldLower = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

/** SEARCH (préfixe sur nomOwnerLower) */
router.get('/search/partners', authGuard, [
  query('q').isString().trim().notEmpty(),
  query('limit').optional().isInt({min:1,max:20})
], async (req, res) => {
  const q = foldLower(req.query.q);
  const limit = parseInt(req.query.limit || '10', 10);
  const snap = await db.collection('partners')
    .orderBy('nomOwnerLower')
    .startAt(q).endAt(q + '\uf8ff')
    .limit(limit).get();

  const results = snap.docs.map(d => {
    const p = d.data()||{};
    return {
      uid: d.id,
      nomOwner: p.nomOwner || null,
      displayName: p.displayName || p.nom || null,
      user: p.user || null,
    };
  });
  res.json({ results });
});

/** LOOKUP (exact nomOwnerLower) */
router.get('/lookup/partner', authGuard, [
  query('nomOwner').isString().trim().notEmpty()
], async (req, res) => {
  const key = foldLower(req.query.nomOwner);
  const snap = await db.collection('partners')
    .where('nomOwnerLower','==', key).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: 'Partner not found' });
  const d = snap.docs[0]; const p = d.data()||{};
  res.json({ partner: { uid: d.id, nomOwner: p.nomOwner, displayName: p.displayName || p.nom || p.nomOwner } });
});

module.exports = router;
