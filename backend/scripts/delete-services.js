/**
 * delete-services.js
 * Supprime TOUTE la collection "services"
 * Compatible Node.js (CommonJS)
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteAllServices() {
  console.log("⚠️ Suppression de TOUTE la collection 'services'...");

  const batchLimit = 400; // sécurité < 500
  let totalDeleted = 0;

  while (true) {
    const snapshot = await db.collection("services").limit(batchLimit).get();

    if (snapshot.empty) {
      console.log("🎉 Aucun autre document. Nettoyage terminé.");
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      totalDeleted++;
    });

    await batch.commit();
    console.log(`🗑️ Batch supprimé : ${snapshot.size} documents`);
  }

  console.log(`✅ Total supprimé : ${totalDeleted} services`);
}

deleteAllServices()
  .then(() => {
    console.log("🚀 Script terminé avec succès.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("🔥 Erreur :", err);
    process.exit(1);
  });
