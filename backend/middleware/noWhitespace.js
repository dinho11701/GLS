// backend/middleware/noWhitespace.js
module.exports = function rejectWhitespaceAnywhere(fields = []) {
  return function (req, res, next) {
    const offenders = [];
    const b = req.body || {};

    fields.forEach((field) => {
      const val = b[field];
      if (typeof val === 'string' && /\s/.test(val)) {
        offenders.push(field);
      }
    });

    if (offenders.length) {
      return res.status(400).json({
        error: 'WhitespaceNotAllowed',
        details: offenders.map((field) => ({ field, msg: 'ne doit pas contenir d’espaces' })),
      });
    }

    next();
  };
};
