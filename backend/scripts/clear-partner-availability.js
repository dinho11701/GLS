/**
 * 🧹 CLEAR partner_availability COLLECTION
 * Supprime TOUS les documents (one-shot)
 */

const path = require("path");
const admin = require("firebase-admin");

// --- Init Firebase Admin ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.join(__dirname, "../serviceAccountKey.json"))
    ),
  });
}

const db = admin.firestore();

async function clearPartnerAvailability() {
  console.log("🚀 Starting FULL CLEAN of partner_availability...");

  const snap = await db.collection("partner_availability").get();

  if (snap.empty) {
    console.log("✅ Collection déjà vide. Rien à faire.");
    return;
  }

  console.log(`⚠️ ${snap.size} documents trouvés. Suppression en cours...`);

  let deleted = 0;

  // Firestore limite batch = 500
  const chunks = [];
  snap.docs.forEach((doc, i) => {
    const chunkIndex = Math.floor(i / 500);
    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
    chunks[chunkIndex].push(doc);
  });

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((doc) => {
      batch.delete(doc.ref);
      deleted++;
    });
    await batch.commit();
    console.log(`🗑 Batch supprimé (${chunk.length} docs)`);
  }

  console.log(`🎉 Nettoyage terminé. ${deleted} documents supprimés.`);
}

clearPartnerAvailability()
  .then(() => {
    console.log("✅ Script exécuté avec succès.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erreur pendant la purge:", err);
    process.exit(1);
  });