/**
 * reset_all_reservations.js
 * 
 * 🧹 Remet toutes les réservations Firestore en:
 *    - status: "pending"
 *    - cancelledAt: null
 *    - cancelledBy: null
 *    - updatedAt: now
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("🚀 Démarrage du RESET complet des réservations…");

  const snap = await db.collection("reservations").get();
  console.log(`📦 Total réservations trouvées : ${snap.size}`);

  let count = 0;

  for (const doc of snap.docs) {
    const ref = doc.ref;
    const data = doc.data();

    const patch = {
      status: "pending",
      cancelledAt: null,
      cancelledBy: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      await ref.update(patch);
      console.log(`✅ ${doc.id} → reset`);
      count++;
    } catch (err) {
      console.log(`❌ ERREUR reset ${doc.id} :`, err.message);
    }
  }

  console.log("🎉 RESET TERMINÉ !");
  console.log(`🔁 Réservations mises à jour : ${count}`);
}

run()
  .catch(err => console.error("❌ Fatal error:", err))
  .finally(() => process.exit());
