/**
 * Script pour corriger Availability.days
 * Passe de 7 → 0 (dimanche)
 */

const admin = require("firebase-admin");

// ⚠️ Mets ton chemin vers la clé serviceAccount JSON
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixDays() {
  console.log("🚀 Correction des jours (7 → 0) en cours...\n");

  const snap = await db.collection("services").get();
  let corrected = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Vérifie présence Availability.days
    const days = data?.Availability?.days;
    if (!Array.isArray(days)) {
      skipped++;
      continue;
    }

    // Si aucun 7 → rien à faire
    if (!days.includes(7)) {
      skipped++;
      continue;
    }

    // Correction : remplace 7 par 0
    const newDays = days.map(d => (d === 7 ? 0 : d));

    console.log(`🛠 Correction service ${doc.id} :`, days, "→", newDays);

    // Mise à jour Firestore
    await doc.ref.update({
      "Availability.days": newDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    corrected++;
  }

  console.log("\n🎉 Correction terminée !");
  console.log(`✔ Services corrigés : ${corrected}`);
  console.log(`➡ Services déjà OK : ${skipped}`);
}

fixDays()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ ERREUR :", err);
    process.exit(1);
  });
