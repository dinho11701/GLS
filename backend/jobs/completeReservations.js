const { db } = require("../config/firebase");

async function completeReservations() {
  const now = new Date();

  const snap = await db
    .collection("reservations")
    .where("status", "in", ["pending", "confirmed"])
    .where("endAt", "<=", now)
    .get();

  if (snap.empty) return;

  const batch = db.batch();

  snap.forEach((doc) => {
    const r = doc.data();

    // 1️⃣ passer la réservation à completed
    batch.update(doc.ref, {
      status: "completed",
      "review.needsReview": true,
      "review.enabledAt": new Date(),
      "review.submitted": false,
      updatedAt: new Date(),
    });

    // 2️⃣ créer la notif client
    const notifRef = db
      .collection("customers")
      .doc(r.customerId)
      .collection("notifs")
      .doc();

    batch.set(notifRef, {
      type: "review",
      title: "Donnez votre avis ⭐",
      body: "Votre réservation est terminée. Laissez un avis.",
      data: { reservationId: doc.id },
      status: "unread",
      createdAt: new Date(),
      readAt: null,
    });
  });

  await batch.commit();
  console.log(`✔ ${snap.size} réservation(s) complétée(s)`);
}

module.exports = { completeReservations };