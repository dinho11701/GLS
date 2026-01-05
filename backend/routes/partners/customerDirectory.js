// routes/partners/customerDirectory.js
const express = require('express');
const { query } = require('express-validator');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();
const foldLower = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

/** SEARCH (préfixe sur userLower) */
router.get('/search/customers', authGuard, [
  query('q').isString().trim().notEmpty(),
  query('limit').optional().isInt({min:1,max:20})
], async (req, res) => {
  const q = foldLower(req.query.q);
  const limit = parseInt(req.query.limit || '10', 10);
  const snap = await db.collection('customers')
    .orderBy('userLower')
    .startAt(q).endAt(q + '\uf8ff')
    .limit(limit).get();

  const results = snap.docs.map(d => {
    const u = d.data()||{};
    return {
      uid: d.id,
      user: u.user || null,
      displayName: u.displayName || [u.firstName,u.lastName].filter(Boolean).join(' ') || null,
      email: u.email || null,
    };
  });
  res.json({ results });
});

/** LOOKUP (exact userLower) */
router.get('/lookup/customer', authGuard, [
  query('user').isString().trim().notEmpty()
], async (req, res) => {
  const key = foldLower(req.query.user);
  const snap = await db.collection('customers')
    .where('userLower','==', key).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: 'Customer not found' });
  const d = snap.docs[0]; const u = d.data()||{};
  res.json({ customer: { uid: d.id, user: u.user, displayName: u.displayName || [u.firstName,u.lastName].filter(Boolean).join(' ') } });
});

module.exports = router;
