// backend/routes/partners/profile.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../../config/firebase');        // <-- adapte le chemin si besoin
const authGuard = require('../../middleware/authGuard'); // <-- vérifie le Bearer ID token

const router = express.Router();

/**
 * Schéma de données attendu (exemple)
 * {
 *   partenaire_ID: "HV-010",
 *   nom: "PowerCity",
 *   secteur: "Énergie",
 *   numeroPhone: "+1 438 111 2222",
 *   adresse: "1010 St Urbain, Montréal, QC",
 *   mail: "ops@powercity.ca",
 *   logo: "https://cdn.example/powercity.png",
 *   nomOwner: "Nadia D.",
 *   user: "powercity_admin"
 * }
 */

// -------- GET /api/v1/partners/profile --------
router.get('/profile', authGuard, async (req, res) => {
  try {
    const uid = req.user.uid; // mis par authGuard après vérif ID token
    const ref = db.collection('partners').doc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        ok: false,
        error: 'PROFILE_NOT_FOUND',
        message: 'Aucun profil partenaire pour cet utilisateur.',
      });
    }

    return res.json({ ok: true, item: snap.data() });
  } catch (err) {
    console.error('GET partners/profile error:', err);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: 'Erreur serveur lors de la récupération du profil.',
    });
  }
});

// -------- PUT /api/v1/partners/profile --------
// Remplace/crée le profil complet (idempotent)
router.put(
  '/profile',
  authGuard,
  [
    body('partenaire_ID').optional().isString().trim().isLength({ min: 2 }),
    body('nom').isString().trim().isLength({ min: 2 }).withMessage('nom requis'),
    body('secteur').optional().isString().trim(),
    body('numeroPhone').optional().isString().trim().isLength({ min: 5 }),
    body('adresse').optional().isString().trim().isLength({ min: 5 }),
    body('mail').optional().isEmail().withMessage('mail invalide').bail().normalizeEmail(),
    body('logo').optional().isURL().withMessage('logo doit être une URL valide'),
    body('nomOwner').optional().isString().trim().isLength({ min: 2 }),
    body('user').optional().isString().trim().isLength({ min: 2 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ ok: false, error: 'VALIDATION_ERROR', details: errors.array() });
    }

    try {
      const uid = req.user.uid;
      const ref = db.collection('partners').doc(uid);
      const now = new Date();

      // construit le champ "searchable" pour la recherche plein texte rudimentaire
      const fields = [
        'partenaire_ID', 'nom', 'secteur', 'numeroPhone', 'adresse',
        'mail', 'nomOwner', 'user',
      ];

      const searchable = fields
        .map((f) => (req.body[f] ? String(req.body[f]).toLowerCase() : ''))
        .join(' ');

      // on remplace tout le document (PUT = remplace)
      await db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        const base = {
          ...req.body,
          searchable,
          updatedAt: now,
        };
        if (!snap.exists) {
          base.createdAt = now;
        }
        t.set(ref, base, { merge: false }); // PUT = pas merge
      });

      const updated = await ref.get();
      return res.status(200).json({ ok: true, item: updated.data() });
    } catch (err) {
      console.error('PUT partners/profile error:', err);
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: 'Erreur serveur lors de la mise à jour du profil.',
      });
    }
  }
);

module.exports = router;
