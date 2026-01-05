// backend/routes/customers/reviews_pending.js
const express = require("express");
const { db } = require("../../config/firebase");
const authGuard = require("../../middleware/authGuard");

const router = express.Router();

router.get("/", authGuard, async (req, res) => {
  try {
    const uid = req.user.uid;

    const snap = await db
      .collection("reservations")
      .where("customerUid", "==", uid)
      .where("review.needsReview", "==", true)
      .limit(1)
      .get();

    const items = snap.docs.map(d => ({
      reservationId: d.id,
      serviceId: d.data().serviceId,
      serviceName: d.data().serviceName,
      ...d.data(),
    }));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("PENDING REVIEW ERROR", err);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
