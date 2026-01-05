// utils/displayName.js (ou en haut du fichier routes)
const { db } = require('../../config/firebase');

async function getCustomerDisplayName(uid) {
  if (!uid) return null;
  const snap = await db.collection('customers').doc(uid).get();
  if (!snap.exists) return null;
  const u = snap.data() || {};
  return (
    u.displayName ||
    u.fullName ||
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
    null
  );
}

async function getPartnerDisplayName(uid) {
  if (!uid) return null;
  const snap = await db.collection('partners').doc(uid).get();
  if (!snap.exists) return null;
  const u = snap.data() || {};
  return (
    u.displayName ||
    u.fullName ||
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
    null
  );
}

module.exports = { getCustomerDisplayName, getPartnerDisplayName };
