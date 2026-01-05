// routes/partners/lookup.js
const express = require('express');
const { query, validationResult } = require('express-validator');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();

// GET /api/v1/partners/resolveByOwner?q=...
router.get('/resolveByOwner',
  authGuard,
  [ query('q').isString().trim().notEmpty() ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array({onlyFirstError:true}) });

    const q = String(req.query.q || '').trim().toLowerCase();

    const snap = await db.collection('partners')
      .orderBy('nomOwnerLower')
      .startAt(q)
      .endAt(q + '\uf8ff')
      .limit(10)
      .get();

    const results = snap.docs.map(d => {
      const x = d.data() || {};
      return {
        uid: d.id,
        nomOwner: x.nomOwner || null,
        nom: x.nom || null,
        partenaire_ID: x.partenaire_ID || null,
        mail: x.mail || x.email || null,
      };
    });

    res.json({ results });
  }
);

module.exports = router;
