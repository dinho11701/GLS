// scripts/backfillLookupFields.js
require('dotenv').config();
const { db } = require('../config/firebase');

// normalisation: minuscules + sans accents
const normLower = (s='') =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

async function backfillPartners() {
  console.log('Backfill partners.nomOwnerLower ...');
  const snap = await db.collection('partners').get();
  const docs = snap.docs;

  let updated = 0, skipped = 0, batch = db.batch(), countInBatch = 0;
  const flush = async () => { if (countInBatch) { await batch.commit(); batch = db.batch(); countInBatch = 0; } };

  for (const d of docs) {
    const x = d.data() || {};
    const lower = normLower(x.nomOwner || '');
    if (!lower) { skipped++; continue; }
    if (x.nomOwnerLower === lower) { skipped++; continue; }

    batch.update(d.ref, { nomOwnerLower: lower });
    countInBatch++; updated++;

    if (countInBatch >= 400) await flush(); // marge sous 500
  }
  await flush();
  console.log(`Partners done. updated=${updated}, skipped=${skipped}, total=${docs.length}`);
}

async function backfillCustomers() {
  console.log('Backfill customers.userLower ...');
  const snap = await db.collection('customers').get();
  const docs = snap.docs;

  let updated = 0, skipped = 0, batch = db.batch(), countInBatch = 0;
  const flush = async () => { if (countInBatch) { await batch.commit(); batch = db.batch(); countInBatch = 0; } };

  for (const d of docs) {
    const x = d.data() || {};
    const lower = normLower(x.user || '');
    if (!lower) { skipped++; continue; }
    if (x.userLower === lower) { skipped++; continue; }

    batch.update(d.ref, { userLower: lower });
    countInBatch++; updated++;

    if (countInBatch >= 400) await flush();
  }
  await flush();
  console.log(`Customers done. updated=${updated}, skipped=${skipped}, total=${docs.length}`);
}

(async () => {
  await backfillPartners();
  await backfillCustomers();
  console.log('✅ Backfill terminé.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
