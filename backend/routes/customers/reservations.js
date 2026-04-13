//routes/customers/reservation.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const { DateTime } = require("luxon");
const { v4: generateUUID } = require("uuid");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");

const router = express.Router();
const BUSINESS_TIMEZONE = "America/Toronto";

/* ============================================================
   HELPERS
============================================================ */

function formatValidationErrors(errors) {
  return errors.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));
}

/* ============================================================
   CREATE RESERVATION
============================================================ */

router.post(
  "/",
  authGuard,
  [
    body("serviceId").isInt(),
    body("date").isISO8601(),
    body("startTime").notEmpty(),
    body("endTime").notEmpty(),
  ],
  async (req, res) => {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        errors: formatValidationErrors(validationErrors),
      });
    }

    const connection = await dbPool.getConnection();

    try {
      await connection.beginTransaction();

      const customerId = req.user.id;
      const { serviceId, date, startTime, endTime } = req.body;

      /* 1️⃣ Fetch service */
      const [serviceRows] = await connection.query(
        `
        SELECT 
          s.id,
          s.owner_id,
          s.name,
          s.base_price,
          s.currency_id
        FROM services s
        WHERE s.id = ?
        `,
        [serviceId]
      );

      if (!serviceRows.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Service not found" });
      }

      const service = serviceRows[0];

      /* 2️⃣ Compute datetime */
      const startDateTime = DateTime.fromISO(
        `${date}T${startTime}`,
        { zone: BUSINESS_TIMEZONE }
      );

      const endDateTime = DateTime.fromISO(
        `${date}T${endTime}`,
        { zone: BUSINESS_TIMEZONE }
      );

      const durationMinutes = Math.floor(
        endDateTime.diff(startDateTime, "minutes").minutes
      );

      /* 3️⃣ Compute taxes */
      const [taxRows] = await connection.query(
        `SELECT rate FROM tax_rates WHERE is_active = TRUE`
      );

      const baseAmount = Number(service.base_price);

      const totalTaxRate = taxRows.reduce(
        (sum, tax) => sum + Number(tax.rate),
        0
      );

      const taxAmount = Number((baseAmount * totalTaxRate).toFixed(2));
      const totalAmount = Number((baseAmount + taxAmount).toFixed(2));

      /* 4️⃣ Status pending */
      const [statusRows] = await connection.query(
        `SELECT id FROM reservation_statuses WHERE code = 'pending' LIMIT 1`
      );

      const pendingStatusId = statusRows[0].id;

      const reservationUUID = generateUUID();

/* 🔥 CHECK INSTANCES BEFORE BOOKING */
const [checkRows] = await connection.query(
  `SELECT instances FROM services WHERE id = ?`,
  [serviceId]
);

if (!checkRows.length || checkRows[0].instances <= 0) {
  await connection.rollback();
  return res.status(400).json({ error: "Pas de places disponible" });
}

      /* 5️⃣ Insert reservation */
      await connection.query(
        `
        INSERT INTO reservations (
          reservation_uuid,
          customer_id,
          partner_id,
          service_id,
          status_id,
          currency_id,
          base_amount,
          tax_amount,
          total_amount,
          timezone,
          start_at,
          end_at,
          duration_minutes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          reservationUUID,
          customerId,
          service.owner_id,
          service.id,
          pendingStatusId,
          service.currency_id,
          baseAmount,
          taxAmount,
          totalAmount,
          BUSINESS_TIMEZONE,
          startDateTime.toSQL(),
          endDateTime.toSQL(),
          durationMinutes,
        ]
      );

/* 🔥 6️⃣ Decrease instances */
await connection.query(
  `
  UPDATE services
  SET instances = instances - 1
  WHERE id = ? AND instances > 0
  `,
  [service.id]
);

      /* 6️⃣ Create notification */
      await connection.query(
        `
        INSERT INTO notifications (
          user_id,
          user_type,
          type,
          title,
          message,
          reference_id
        )
        VALUES (?, 'customer', ?, ?, ?, ?)
        `,
        [
          customerId,
          "reservation_created",
          "Réservation confirmée",
          `Votre réservation pour "${service.name}" est enregistrée.`,
          reservationUUID,
        ]
      );

      await connection.commit();

      return res.status(201).json({
        reservationId: reservationUUID,
        pricing: {
          baseAmount,
          taxAmount,
          totalAmount,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("[CREATE RESERVATION ERROR]", error);
      return res.status(500).json({ error: "Server error" });
    } finally {
      connection.release();
    }
  }
);

/* ============================================================
   LIST CUSTOMER RESERVATIONS
============================================================ */

router.get("/", authGuard, async (req, res) => {
  try {
    const customerId = req.user.id;

    const [rows] = await dbPool.query(
      `
      SELECT 
        r.reservation_uuid,
        rs.code AS status,
        r.start_at,
        r.end_at,
        r.base_amount,
        r.tax_amount,
        r.total_amount,
        c.code AS currency_code,
        s.name AS service_name
      FROM reservations r
      JOIN reservation_statuses rs ON r.status_id = rs.id
      JOIN currencies c ON r.currency_id = c.id
      JOIN services s ON r.service_id = s.id
      WHERE r.customer_id = ?
      ORDER BY r.start_at DESC
      `,
      [customerId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("[LIST RESERVATIONS ERROR]", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================
   GET RESERVATION DETAIL
============================================================ */

router.get("/:uuid", authGuard, async (req, res) => {
  try {
    const customerId = req.user.id;
    const reservationUUID = req.params.uuid;

    const [rows] = await dbPool.query(
      `
      SELECT 
        r.*,
        rs.code AS status,
        c.code AS currency_code,
        s.name AS service_name
      FROM reservations r
      JOIN reservation_statuses rs ON r.status_id = rs.id
      JOIN currencies c ON r.currency_id = c.id
      JOIN services s ON r.service_id = s.id
      WHERE r.reservation_uuid = ?
      `,
      [reservationUUID]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = rows[0];

    if (reservation.customer_id !== customerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(reservation);
  } catch (error) {
    console.error("[GET RESERVATION ERROR]", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================
   CANCEL RESERVATION
============================================================ */

router.delete("/:uuid", authGuard, async (req, res) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    const customerId = req.user.id;
    const reservationUUID = req.params.uuid;

    const [rows] = await connection.query(
      `
      SELECT id, customer_id, status_id, service_id
      FROM reservations
      WHERE reservation_uuid = ?
      `,
      [reservationUUID]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = rows[0];

    if (reservation.customer_id !== customerId) {
      await connection.rollback();
      return res.status(403).json({ error: "Forbidden" });
    }

    /* Get cancelled status id */
    const [statusRows] = await connection.query(
      `SELECT id FROM reservation_statuses WHERE code = 'cancelled' LIMIT 1`
    );

    const cancelledStatusId = statusRows[0].id;

/* Prevent double cancel */
if (reservation.status_id === cancelledStatusId) {
  await connection.rollback();
  return res.status(400).json({ error: "Already cancelled" });
}

await connection.query(
  `
  UPDATE reservations
  SET status_id = ?, updated_at = NOW()
  WHERE reservation_uuid = ?
  `,
  [cancelledStatusId, reservationUUID]
);

/* 🔥 Restore instances */
await connection.query(
  `
  UPDATE services
  SET instances = instances + 1
  WHERE id = ?
  `,
  [reservation.service_id]
);

    /* Notification */
    await connection.query(
      `
      INSERT INTO notifications (
        user_id,
        user_type,
        type,
        title,
        message,
        reference_id
      )
      VALUES (?, 'customer', ?, ?, ?, ?)
      `,
      [
        customerId,
        "reservation_cancelled",
        "Réservation annulée",
        "Votre réservation a été annulée.",
        reservationUUID,
      ]
    );

    await connection.commit();

    return res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("[CANCEL RESERVATION ERROR]", error);
    return res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
});

module.exports = router;