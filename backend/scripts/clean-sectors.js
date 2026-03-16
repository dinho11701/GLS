// CommonJS version for Node.js
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// Init Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function removeSectors() {
  console.log("🚀 Suppression des champs Activity_Secteur et Categorie...");

  const servicesRef = db.collection("services");
  const snapshot = await servicesRef.get();

  if (snapshot.empty) {
    console.log("❌ Aucun service trouvé.");
    return;
  }

  let count = 0;
  let batch = db.batch();
  const batches = [];
  let opCount = 0;

  snapshot.forEach((doc) => {
    batch.update(doc.ref, {
      Activity_Secteur: admin.firestore.FieldValue.delete(),
      Categorie: admin.firestore.FieldValue.delete(),
    });

    opCount++;
    count++;

    // Firestore batch limit = 500
    if (opCount === 400) {
      batches.push(batch.commit());
      batch = db.batch();
      opCount = 0;
    }
  });

  if (opCount > 0) batches.push(batch.commit());

  await Promise.all(batches);

  console.log(`✅ Terminé : ${count} services mis à jour.`);
}

removeSectors()
  .then(() => {
    console.log("🎉 Script terminé avec succès.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("🔥 Erreur :", err);
    process.exit(1);
  });
