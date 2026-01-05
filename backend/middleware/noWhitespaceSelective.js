// backend/middleware/noWhitespaceSelective.js
module.exports = function noWhitespaceSelective(fields = []) {
  return function (req, res, next) {
    try {
      const src = req.body || {};
      for (const f of fields) {
        if (src[f] == null) continue;
        if (typeof src[f] !== 'string') continue;
        // Interdit espaces/retours UNIQUEMENT pour ces champs
        if (/\s/.test(src[f])) {
          return res.status(400).json({
            ok: false,
            error: `Le champ "${f}" ne doit pas contenir d'espaces`,
          });
        }
      }
      next();
    } catch (e) {
      next(e);
    }
  };
};
