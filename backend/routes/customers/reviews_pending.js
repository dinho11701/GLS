const express = require("express");
const { db } = require("../../config/firebase");
const authGuard = require("../../middleware/authGuard");

const router = express.Router();

router.get("/", authGuard, async (req, res) => {
  const uid = req.user.uid;

  try {
    const snap = await db
      .collection("reservations")
      .where("customerId", "==", uid)
      .where("review.needsReview", "==", true)
      .limit(5)
      .get();

    // ⭐⭐⭐ LIGNE CRUCIALE — À NE JAMAIS ENLEVER ⭐⭐⭐
    res.set("Cache-Control", "no-store");

    if (snap.empty) {
      return res.json({ ok: true, item: null });
    }

    // 🔎 on prend la PREMIÈRE réservation valide
    for (const doc of snap.docs) {
      const data = doc.data();

      if (!data.serviceDocId) {
        console.warn(
          `⚠️ Reservation ${doc.id} ignorée (serviceDocId manquant)`
        );
        continue; // skip legacy
      }

      return res.json({
        ok: true,
        item: {
          reservationId: doc.id,
          serviceDocId: data.serviceDocId,
          serviceName: data.serviceTitle || null,
        },
      });
    }

    // aucune réservation exploitable
    return res.json({ ok: true, item: null });

  } catch (err) {
    console.error("[REVIEWS_PENDING]", err);

    // ⭐ aussi ici, pour éviter cache d’erreur
    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, item: null });
  }
});

module.exports = router;
