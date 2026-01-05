/**
 * Delete ALL reservations from Firestore
 * Run with: node scripts/deleteAllReservations.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// Initialize admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteCollectionBatch(collectionPath, batchSize = 300) {
  const collectionRef = db.collection(collectionPath);

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();

    if (snapshot.empty) {
      console.log("✔️ Aucune autre réservation, suppression terminée.");
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
    console.log(`🗑️ Supprimé ${snapshot.size} réservations…`);
  }
}

async function start() {
  console.log("--------------------------------------------------");
  console.log("⚠️ SUPPRESSION TOTALE DE LA COLLECTION 'reservations'");
  console.log("--------------------------------------------------");

  try {
    await deleteCollectionBatch("reservations");
    console.log("🎉 Toutes les réservations ont été supprimées.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erreur:", e);
    process.exit(1);
  }
}

start();
