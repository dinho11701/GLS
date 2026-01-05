// tools/backfill-lower.js
const { db } = require('../config/firebase');
const foldLower = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

(async () => {
  const batch = db.batch();
  const cus = await db.collection('customers').get();
  cus.forEach(d => {
    const u = d.data()||{};
    const userLower = foldLower(u.user || u.username || u.handle || '');
    if (userLower) batch.update(d.ref, { userLower });
  });
  const parts = await db.collection('partners').get();
  parts.forEach(d => {
    const p = d.data()||{};
    const nomOwnerLower = foldLower(p.nomOwner || p.ownerName || '');
    if (nomOwnerLower) batch.update(d.ref, { nomOwnerLower });
  });
  await batch.commit();
  console.log('Lower fields backfilled.');
  process.exit(0);
})();
