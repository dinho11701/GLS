// backend/middleware/ensurePartner.js
module.exports = function ensurePartner(req, res, next) {
  try {
    const claims = req.user?.claims || {};
    const isPartner =
      claims.isPartner === true ||
      claims.role === 'partner' ||
      claims.role === 'pro';

    if (!isPartner) {
      return res.status(403).json({
        ok: false,
        error: 'Accès réservé aux partenaires.',
      });
    }

    return next();
  } catch (e) {
    console.error('[ensurePartner][ERROR]', e);
    return res.status(500).json({ ok: false, error: 'Erreur serveur (ensurePartner).' });
  }
};
