require("dotenv").config();
const { db } = require("../config/firebase");

(async () => {
  console.log("🚀 Début du nettoyage des services orphelins…");

  const servicesSnap = await db.collection("services").get();
  if (servicesSnap.empty) {
    console.log("❌ Aucun service trouvé.");
    return;
  }

  let deleteCount = 0;
  let skipCount = 0;

  for (const doc of servicesSnap.docs) {
    const serviceId = doc.id;
    const data = doc.data();

    const hasOwner =
      data.partnerUid ||
      data.ownerUid ||
      data.hostUid;

    // 👉 Si le service a déjà un propriétaire → ne pas toucher
    if (hasOwner) {
      skipCount++;
      continue;
    }

    // 👉 Vérification : est-ce qu’il existe des réservations qui le pointent ?
    const reservationsSnap = await db
      .collection("reservations")
      .where("serviceId", "==", serviceId)
      .get();

    const reservationCount = reservationsSnap.size;

    console.log(
      `⚠️ Service ${serviceId} sans ownerUid | Réservations liées: ${reservationCount}`
    );

    // 👉 S’il y a des réservations, on log mais on supprime quand même : c’est ton choix
    // (sinon elles resteront orphelines et ton système ne les utilise plus)
    await db.collection("services").doc(serviceId).delete();
    console.log(`🗑️ Service ${serviceId} supprimé`);

    deleteCount++;
  }

  console.log("\n🎉 Nettoyage terminé !");
  console.log(`🗑️ Services supprimés : ${deleteCount}`);
  console.log(`⏭️ Services ignorés (valide) : ${skipCount}`);
})();
