// routes/customers/reservations.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const { db } = require("../../config/firebase");
const authGuard = require("../../middleware/authGuard");
const { DateTime } = require("luxon");
const { checkAvailability } = require("../../utils/checkAvailability");

const router = express.Router();
const TZ = "America/Toronto";

/* ---------- HELPERS ---------- */
function toHttpError(errors) {
  return {
    errors: errors.array().map((e) => ({ field: e.path, msg: e.msg })),
  };
}

function buildCalendarDim(dateObj, tz = TZ, time = null) {
  const dt = DateTime.fromJSDate(dateObj, { zone: tz });

  return {
    date_id: Number(dt.toFormat("yyyyLLdd")),
    date: dt.toFormat("yyyy-LL-dd"),
    day: dt.day,
    day_txt: dt.toFormat("ccc"),
    week: Number(dt.toFormat("W")),
    month: dt.month,
    month_txt: dt.toFormat("LLL"),
    year: dt.year,
    time: time || dt.toFormat("HH:mm"),
  };
}

/* ============================================================================
   POST /customers/reservations — CREATE
============================================================================ */
router.post(
  "/",
  authGuard,
  [
    body("serviceId").notEmpty().withMessage("serviceId requis"),
    body("date").isString().withMessage("date requise"),
    body("startTime").isString().withMessage("startTime requis"),
    body("endTime").isString().withMessage("endTime requis"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(toHttpError(errors));

    try {
      const { serviceId, date, startTime, endTime } = req.body;
      const customerId = req.user.uid;

      const svcDoc = await db.collection("services").doc(serviceId).get();
      if (!svcDoc.exists)
        return res.status(404).json({ error: "Service introuvable" });

      const svc = svcDoc.data();
      const partnerUid = svc.ownerUid;

      if (!partnerUid)
        return res.status(400).json({ error: "Service sans partenaire" });

      /* Check availability */
      const available = await checkAvailability({
        partnerUid,
        serviceId,
        date,
        startTime,
        endTime,
      });

      if (!available.ok) {
        return res.status(409).json({ error: available.reason });
      }

      const durationMin = available.durationMin;

      const startDt = DateTime.fromISO(`${date}T${startTime}`, { zone: TZ });
      const endDt = DateTime.fromISO(`${date}T${endTime}`, { zone: TZ });

      const ref = db.collection("reservations").doc();
      const now = new Date();
      const calendar = buildCalendarDim(startDt.toJSDate(), TZ, startTime);

      await ref.set({
        reservationId: ref.id,
        customerId,
        serviceId,
        partnerUid,
        status: "pending",
        tz: TZ,

        startAt: startDt.toUTC().toJSDate(),
        endAt: endDt.toUTC().toJSDate(),
        durationMin,

        price: svc.Fee ?? null,
        currency: svc.Pricing?.currency || "CAD",

        calendar,
        createdAt: now,
        updatedAt: now,
      });

	
      /* ---------------------------------------------------------
   ⭐ AJOUT NOTIFICATION CÔTÉ CLIENT
--------------------------------------------------------- */
try {
  await db
    .collection("customers")
    .doc(customerId)
    .collection("notifs")
    .doc() // auto-ID
    .set({
      type: "reservation",
      title: "Réservation confirmée",
      body: `Votre réservation pour "${svc.Service}" est bien enregistrée.`,
      data: { reservationId: ref.id },
      status: "unread",
      createdAt: new Date(),
      readAt: null,
    });
} catch (notifErr) {
  console.error("[RESERVATION → NOTIF ERROR]", notifErr);
}



      return res.status(201).json({ reservationId: ref.id });
    } catch (err) {
      console.error("[RESERVATION ERROR]", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

/* ============================================================================
   GET /customers/reservations → LIST
============================================================================ */
router.get("/", authGuard, async (req, res) => {
  try {
    const customerId = req.user.uid;

    const snap = await db
      .collection("reservations")
      .where("customerId", "==", customerId)
      .orderBy("calendar.date_id", "desc")
      .get();

    const out = [];

    for (const doc of snap.docs) {
      const r = doc.data();

      let autoDate = null;
      let autoTime = null;

      if (r.startAt) {
        const js = r.startAt.toDate ? r.startAt.toDate() : new Date(r.startAt);
        autoDate = js.toISOString().substring(0, 10);
        autoTime = js.toISOString().substring(11, 16);
      }

      let serviceName = "";
      let coverUrl = null;

      try {
        const s = await db.collection("services").doc(r.serviceId).get();
        if (s.exists) {
          const data = s.data();
          serviceName = data.Service || "";
          coverUrl = data.coverUrl || null;
        }
      } catch {}

      out.push({
        reservationId: r.reservationId,
        serviceName,
        coverUrl,
        status: r.status,
        date: r.calendar?.date || autoDate,
        time: r.calendar?.time || autoTime,
        startAt: r.startAt,
        endAt: r.endAt,
        price: r.price,
        currency: r.currency,
      });
    }

    return res.status(200).json(out);
  } catch (err) {
    console.error("[GET RESERVATIONS ERROR]", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ============================================================================
   GET /customers/reservations/:id → DETAIL
============================================================================ */
router.get("/:id", authGuard, async (req, res) => {
  try {
    const customerId = req.user.uid;
    const reservationId = req.params.id;

    const snap = await db.collection("reservations").doc(reservationId).get();
    if (!snap.exists)
      return res.status(404).json({ ok: false, error: "Reservation not found" });

    const r = snap.data();

    if (r.customerId !== customerId)
      return res.status(403).json({ ok: false, error: "Forbidden" });

    let autoDate = null;
    let autoTime = null;

    if (r.startAt) {
      const js = r.startAt.toDate ? r.startAt.toDate() : new Date(r.startAt);
      autoDate = js.toISOString().substring(0, 10);
      autoTime = js.toISOString().substring(11, 16);
    }

    let serviceName = "";
    let coverUrl = null;

    try {
      const s = await db.collection("services").doc(r.serviceId).get();
      if (s.exists) {
        const data = s.data();
        serviceName = data.Service || "";
        coverUrl = data.coverUrl || null;
      }
    } catch {}

    return res.json({
      reservationId: r.reservationId,
      serviceName,
      coverUrl,
      status: r.status,
      date: r.calendar?.date || autoDate,
      time: r.calendar?.time || autoTime,
      startAt: r.startAt,
      endAt: r.endAt,
      price: r.price,
      currency: r.currency,
      partnerUid: r.partnerUid,
    });
  } catch (err) {
    console.error("[GET RESERVATION DETAIL ERROR]", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ============================================================================
   DELETE /customers/reservations/:id → CANCEL
============================================================================ */
router.delete("/:id", authGuard, async (req, res) => {
  try {
    const customerId = req.user.uid;
    const reservationId = req.params.id;

    const ref = db.collection("reservations").doc(reservationId);
    const snap = await ref.get();

    if (!snap.exists)
      return res.status(404).json({ error: "Reservation not found" });

    const r = snap.data();

    if (r.customerId !== customerId)
      return res.status(403).json({ error: "Forbidden" });

    if (r.status === "cancelled") {
      return res.status(200).json({ ok: true, message: "Déjà annulée" });
    }

    await ref.update({
      status: "cancelled",
      updatedAt: new Date(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[DELETE RESERVATION ERROR]", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
