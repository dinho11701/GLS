// backend/middleware/ensurePartner.js

module.exports = function ensurePartner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
    }

    const isPartner =
      req.user.role === "partner" ||
      req.user.role === "pro";

    if (!isPartner) {
      return res.status(403).json({
        ok: false,
        error: "Accès réservé aux partenaires.",
      });
    }

    return next();
  } catch (e) {
    console.error("[ensurePartner][ERROR]", e);
    return res
      .status(500)
      .json({ ok: false, error: "Erreur serveur (ensurePartner)." });
  }
};