// backend/routes/auth/customers.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { admin, db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();

/* -----------------------
 * Helpers
 * ---------------------*/
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'ValidationError',
      details: errors.array().map((e) => ({ field: e.path, msg: e.msg })),
    });
    return true;
  }
  return false;
}

/**
 * -----------------------
 * POST /api/v1/auth/signup
 * -----------------------
 */
router.post(
  '/signup',
  [
    body('mail')
      .customSanitizer(v => String(v || '').replace(/\s+/g, '')) // supprime tous espaces
      .isEmail().withMessage('mail invalide')
      .matches(/^\S+$/).withMessage('mail ne doit pas contenir d’espaces')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('password min 6 caractères')
      .matches(/^\S+$/).withMessage('password ne doit pas contenir d’espaces'),
    body('user')
      .optional()
      .trim()
      .isLength({ min: 2, max: 40 }).withMessage('user min 2, max 40')
      .matches(/^[A-Za-z0-9._-]+$/).withMessage('user: lettres, chiffres, . _ -'),
    body('nom').trim().isLength({ min: 2 }).withMessage('nom requis'),
    body('prenom').trim().isLength({ min: 2 }).withMessage('prenom requis'),
    body('phone')
      .optional()
      .matches(/^\+\d{6,15}$/).withMessage('Téléphone au format E.164 (+14165550123)'),
    body('adresse').optional({ nullable: true }).trim().isLength({ max: 300 }),
    body('wallet')
      .optional({ nullable: true })
      .custom((v) => {
        if (v == null || v === '') return true;
        if (typeof v !== 'string') return false;
        const eth = /^0x[a-fA-F0-9]{40}$/;
        return eth.test(v) || v.length <= 100;
      }).withMessage('wallet invalide'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { password, mail, phone, nom, prenom, adresse, user, wallet } = req.body;

    try {
      // 1) Création compte Auth
      const userRecord = await admin.auth().createUser({
        email: mail,
        password,
        displayName: `${prenom} ${nom}`,
        phoneNumber: phone || undefined,
      });

      // 2) Doc Firestore (collection customers)
      const customerRef = db.collection('customers').doc();
      const clientId = `CLI_${customerRef.id}`;
      const nowIso = new Date().toISOString();

      await customerRef.set({
        clientId,
        uid: userRecord.uid,
        user: user || null,
        email: String(mail || '').toLowerCase(),
        phone: phone || null,
        nom,
        prenom,
        adresse: adresse || null,
        wallet: wallet || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // 3) Réponse
      return res.status(201).json({
        message: 'Utilisateur créé avec succès',
        uid: userRecord.uid,
        clientId,
        user: {
          role: 'customer',
          id: customerRef.id,
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          wallet: wallet || null,
          nom,
          prenom,
        },
      });

    } catch (error) {
      console.error('Erreur /auth/signup:', error);
      const code = error?.code || '';
      if (code === 'auth/email-already-exists') return res.status(409).json({ error: 'Email déjà utilisé.' });
      if (code === 'auth/invalid-email')       return res.status(400).json({ error: 'Email invalide.' });
      if (code === 'auth/invalid-phone-number')return res.status(400).json({ error: 'Téléphone invalide.' });
      if (code === 'auth/weak-password')       return res.status(400).json({ error: 'Mot de passe trop faible.' });
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

/**
 * -----------------------
 * POST /api/v1/auth/login
 * -----------------------
 */
router.post(
  '/login',
  [
    body('mail')
      .customSanitizer(v => String(v || '').replace(/\s+/g, '')) // supprime tous espaces
      .isEmail().withMessage('mail invalide')
      .matches(/^\S+$/).withMessage('mail ne doit pas contenir d’espaces')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('password requis')
      .matches(/^\S+$/).withMessage('password ne doit pas contenir d’espaces'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { mail, password } = req.body;

    try {
      // 1) Auth Firebase REST
      const fetch = (await import('node-fetch')).default;
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: mail, password, returnSecureToken: true }),
        }
      );

      const data = await resp.json();
      if (data.error) {
        return res.status(401).json({ error: data.error.message || 'Identifiants invalides' });
      }

      // 2) Récup profil Firestore (via uid)
      let userDoc = null;
      try {
        const snap = await db.collection('customers').where('uid', '==', data.localId).limit(1).get();
        if (!snap.empty) {
          const d = snap.docs[0];
          userDoc = { id: d.id, role: 'customer', ...d.data() };
        }
      } catch (e) {
        console.warn('login: lookup customers by uid failed:', e?.message || e);
      }

      // 3) Réponse normalisée (avec user + role)
      return res.json({
        message: 'Connexion réussie',
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        uid: data.localId,
        user: userDoc || { id: data.localId, role: 'customer', email: mail },
      });
    } catch (error) {
      console.error('Erreur /auth/login:', error);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

/**
 * -----------------------
 * POST /api/v1/auth/refresh
 * -----------------------
 */
router.post(
  '/refresh',
  [body('refreshToken').isString().withMessage('refreshToken manquant')],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { refreshToken } = req.body;
    try {
      const fetch = (await import('node-fetch')).default;
      const resp = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.id_token) {
        return res.status(401).json({ error: data?.error?.message || 'Invalid refreshToken' });
      }
      return res.json({
        idToken: data.id_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
        userId: data.user_id,
      });
    } catch (e) {
      console.error('Erreur /auth/refresh:', e);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

/**
 * -----------------------
 * POST /api/v1/auth/logout  (protégé)
 * -----------------------
 */
router.post('/logout', authGuard, async (req, res) => {
  try {
    const uid = req.user.uid;
    await admin.auth().revokeRefreshTokens(uid);
    const { tokensValidAfterTime } = await admin.auth().getUser(uid);
    return res.json({
      message: 'Déconnexion réussie — refresh tokens révoqués',
      uid,
      tokensValidAfterTime,
    });
  } catch (err) {
    console.error('Erreur /auth/logout:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/**
 * -----------------------
 * GET /api/v1/auth/me  (protégé)
 * -----------------------
 * Renvoie le profil Firestore du customer (via uid) avec role: 'customer'
 */
router.get('/me', authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(400).json({ error: 'missing_uid' });

    const snap = await db.collection('customers').where('uid', '==', uid).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'not_found' });

    const d = snap.docs[0];
    return res.json({ ok: true, user: { id: d.id, role: 'customer', ...d.data() } });
  } catch (e) {
    console.error('Erreur /auth/me:', e);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
