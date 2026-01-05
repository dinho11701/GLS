const { db } = require("../config/firebase");

async function clearReservations() {
  console.log("🔥 Début suppression des réservations...");

  const snap = await db.collection("reservations").get();
  console.log(`📦 ${snap.size} réservations trouvées.`);

  if (snap.empty) {
    console.log("✔️ Aucune réservation à supprimer.");
    return;
  }

  const batch = db.batch();

  snap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  console.log("✅ Toutes les réservations ont été supprimées !");
}

clearReservations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Erreur :", err);
    process.exit(1);
  });
