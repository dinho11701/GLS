// backend/routes/auth/partners.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { admin, db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');
const rejectWhitespaceAnywhere = require('../../middleware/noWhitespace');

const router = express.Router();

/* -----------------------
 * Helpers
 * ---------------------*/
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ ok: false, errors: errors.array() });
    return true; // stop caller
  }
  return false;
}

function buildSearchable({ nom, secteur, adresse, mail, nomOwner, numeroPhone, user }) {
  return [nom, secteur, adresse, mail, nomOwner, numeroPhone, user]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * POST /api/v1/partners/signup (public)
 * - Crée l'utilisateur Firebase Auth
 * - Crée le doc Firestore: collection **partners**, doc **{uid}**
 * - Ajoute des custom claims { typ:'partner', partenaire_ID }
 */
router.post(
  '/signup',
  // supprime tout espace dans user/mail/password (fallback robuste)
  rejectWhitespaceAnywhere(['user', 'mail', 'password']),
  [
    body('partenaire_ID').optional().isString().isLength({ min: 2, max: 64 }).trim(),
    body('nom').isString().isLength({ min: 2 }).trim(),
    body('secteur').isString().isLength({ min: 2 }).trim(),
    body('numeroPhone').isString().isLength({ min: 5 }).trim(),
    body('adresse').isString().isLength({ min: 2 }).trim(),
    body('mail')
      .customSanitizer(v => String(v || '').replace(/\s+/g, ''))
      .isEmail().withMessage('mail invalide')
      .normalizeEmail(),
    body('logo').optional().isURL(),
    body('nomOwner').isString().isLength({ min: 2 }).trim(),
    body('user').isString().isLength({ min: 3 }).trim(),
    body('password').isString().isLength({ min: 6 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const {
      partenaire_ID, nom, secteur, numeroPhone, adresse, mail,
      logo = null, nomOwner, user, password,
    } = req.body;

    try {
      const mailLc = String(mail || '').toLowerCase();

      // Unicités logiques côté Firestore (mail/user/partenaire_ID) — dans **partners**
      const [mailSnap, userSnap, idSnap] = await Promise.all([
        db.collection('partners').where('mail', '==', mailLc).limit(1).get(),
        db.collection('partners').where('user', '==', user).limit(1).get(),
        partenaire_ID
          ? db.collection('partners').where('partenaire_ID', '==', partenaire_ID).limit(1).get()
          : Promise.resolve({ empty: true }),
      ]);
      if (!mailSnap.empty) return res.status(409).json({ ok: false, error: 'mail_taken' });
      if (!userSnap.empty) return res.status(409).json({ ok: false, error: 'user_taken' });
      if (partenaire_ID && !idSnap.empty) return res.status(409).json({ ok: false, error: 'partenaire_ID_taken' });

      // 1) Crée l'utilisateur Firebase Auth
      let userRecord;
      try {
        userRecord = await admin.auth().createUser({
          email: mailLc,
          password,
          displayName: nomOwner || nom,
        });
      } catch (e) {
        if (e.code === 'auth/email-already-exists') {
          return res.status(409).json({ ok: false, error: 'mail_taken' });
        }
        return res.status(500).json({ ok: false, error: 'auth_create_failed', message: e.message });
      }

      const uid = userRecord.uid;

      // 2) Claims
      const claimPartenaireId = partenaire_ID || uid;
      await admin.auth().setCustomUserClaims(uid, { typ: 'partner', partenaire_ID: claimPartenaireId });

      // 3) Doc Firestore dans **partners/{uid}**
      const now = admin.firestore.FieldValue.serverTimestamp();
      const docPayload = {
        partenaire_ID: claimPartenaireId,
        nom,
        secteur,
        numeroPhone,
        adresse,
        mail: mailLc,
        logo,
        nomOwner,
        user,
        createdAt: now,
        updatedAt: now,
      };
      docPayload.searchable = buildSearchable(docPayload);

      const ref = db.collection('partners').doc(uid); // <-- IMPORTANT: 'partners'
      await ref.set(docPayload, { merge: false });

      const created = await ref.get();
      const item = { id: created.id, ...created.data() };

      // on renvoie déjà un user standardisé (utile côté front)
      return res.status(201).json({
        ok: true,
        user: {
          role: 'host',
          uid,
          id: item.id,
          ...item,
        },
      });
    } catch (err) {
      console.error('POST /partners/signup error:', err);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  }
);

/**
 * POST /api/v1/partners/login (public)
 * Body: { idToken }
 * Vérifie le token et renvoie le profil depuis **partners/{uid}**
 */
router.post(
  '/login',
  [ body('idToken').isString().isLength({ min: 10 }) ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    const { idToken } = req.body;

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const doc = await db.collection('partners').doc(uid).get(); // <-- 'partners'
      if (!doc.exists) return res.status(404).json({ ok: false, error: 'not_found' });

      const item = { id: doc.id, ...doc.data() };
      // réponse harmonisée: toujours un "user" avec "role"
      return res.json({
        ok: true,
        user: {
          role: 'host',
          uid,
          ...item,
        },
        claims: {
          partenaire_ID: decoded.partenaire_ID || decoded.partenaire_id,
          typ: decoded.typ || 'partner',
        },
      });
    } catch (err) {
      console.error('POST /partners/login error:', err);
      return res.status(401).json({ ok: false, error: 'invalid_id_token' });
    }
  }
);

/**
 * POST /api/v1/partners/logout (protégé)
 * (Stateless: signOut côté client)
 */
router.post('/logout', authGuard, (_req, res) => {
  return res.json({ ok: true });
});

/**
 * GET /api/v1/partners/me (protégé)
 * Récupère le profil dans **partners/{uid}**
 */
router.get('/me', authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(400).json({ ok: false, error: 'missing_uid' });

    const doc = await db.collection('partners').doc(uid).get(); // <-- 'partners'
    if (!doc.exists) return res.status(404).json({ ok: false, error: 'not_found' });

    const data = doc.data();
    return res.json({
      ok: true,
      user: { role: 'host', uid, id: doc.id, ...data },
      claims: {
        partenaire_ID: req.user?.claims?.partenaire_ID,
        typ: req.user?.claims?.typ || 'partner',
      },
    });
  } catch (err) {
    console.error('GET /partners/me error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

module.exports = router;
