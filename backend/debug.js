// debug.js
const { db } = require('./config/firebase');

async function debug() {
  const id = '2q9yA5e8An7mmQD9OEsU';

  console.log("🔍 Checking Firestore for ID:", id);

  const doc = await db.collection('services').doc(id).get();

  console.log("exists =", doc.exists);
  console.log("data =", doc.data());
}

debug().then(() => {
  console.log("✔ done");
  process.exit(0);
});
