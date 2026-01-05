// utils/normalize.js
const removeDiacritics = (s='') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

exports.normLower = (s) => removeDiacritics(String(s || '')).toLowerCase().trim();
