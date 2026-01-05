require("dotenv").config();
const { db } = require("../config/firebase");

(async () => {
  console.log("🚀 Début du nettoyage des réservations orphelines…");

  const reservationsSnap = await db.collection("reservations").get();
  if (reservationsSnap.empty) {
    console.log("❌ Aucune réservation trouvée.");
    return;
  }

  let deleteCount = 0;
  let skipCount = 0;

  for (const doc of reservationsSnap.docs) {
    const reservationId = doc.id;
    const data = doc.data();
    const serviceId = data.serviceId;

    if (!serviceId) {
      console.log(`⚠️ Réservation ${reservationId} sans serviceId (orpheline)`);
      await db.collection("reservations").doc(reservationId).delete();
      console.log(`🗑️ Réservation ${reservationId} supprimée`);
      deleteCount++;
      continue;
    }

    // Vérifier si le service existe encore
    const serviceRef = db.collection("services").doc(serviceId);
    const serviceDoc = await serviceRef.get();

    if (!serviceDoc.exists) {
      console.log(`⚠️ Réservation ${reservationId} → service ${serviceId} introuvable`);
      await db.collection("reservations").doc(reservationId).delete();
      console.log(`🗑️ Réservation ${reservationId} supprimée`);
      deleteCount++;
      continue;
    }

    skipCount++;
  }

  console.log("\n🎉 Nettoyage terminé !");
  console.log(`🗑️ Réservations supprimées : ${deleteCount}`);
  console.log(`⏭️ Réservations valides ignorées : ${skipCount}`);
})();
