console.log("🔥 ROUTE customers/reviews.js LOADED");

const express = require("express");
const { body, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");

const router = express.Router();

/* ============================================================
   VALIDATION HELPER
============================================================ */
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ ok: false, errors: errors.array() });
    return true;
  }
  return false;
}

/* ============================================================
   POST /api/v1/customers/reviews
============================================================ */
router.post(
  "/",
  authGuard,
  [
    body("serviceId").isString(), // ⚠️ UUID (char36)
    body("rating").isInt({ min: 1, max: 5 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const connection = await dbPool.getConnection();

    try {
      await connection.beginTransaction();

      const { serviceId, rating, comment = "" } = req.body;
      const customerId = req.user.id;

      /* ---------------- 1️⃣ Service existe ---------------- */
      const [serviceRows] = await connection.query(
        `SELECT id, rating_count, rating_sum FROM services WHERE id = ?`,
        [serviceId]
      );

      if (!serviceRows.length) {
        await connection.rollback();
        return res.status(404).json({
          ok: false,
          error: "Service introuvable",
        });
      }

      const service = serviceRows[0];

      /* ---------------- 2️⃣ Reservation complétée ---------------- */
      const [reservationRows] = await connection.query(
        `
        SELECT id
        FROM reservations
        WHERE customer_id = ?
          AND service_id = ?
          AND end_at < NOW()
        LIMIT 1
        `,
        [customerId, serviceId]
      );

      if (!reservationRows.length) {
        await connection.rollback();
        return res.status(403).json({
          ok: false,
          error:
            "Vous devez avoir complété une réservation avant de laisser un avis.",
        });
      }

      const reservationId = reservationRows[0].id;

      /* ---------------- 3️⃣ Anti doublon ---------------- */
      const [existingReview] = await connection.query(
        `
        SELECT id FROM reviews
        WHERE service_id = ? AND customer_id = ?
        LIMIT 1
        `,
        [serviceId, customerId]
      );

      if (existingReview.length) {
        await connection.rollback();
        return res.status(409).json({
          ok: false,
          error: "Avis déjà envoyé.",
        });
      }

      /* ---------------- 4️⃣ Insert review ---------------- */
      await connection.query(
        `
        INSERT INTO reviews
        (service_id, customer_id, rating, comment)
        VALUES (?, ?, ?, ?)
        `,
        [serviceId, customerId, rating, comment]
      );

      /* ---------------- 5️⃣ Update service stats ---------------- */
      const newRatingCount = Number(service.rating_count || 0) + 1;
      const newRatingSum = Number(service.rating_sum || 0) + Number(rating);
      const newRatingAvg = Number(
        (newRatingSum / newRatingCount).toFixed(2)
      );

      await connection.query(
        `
        UPDATE services
        SET rating_count = ?, rating_sum = ?, rating_avg = ?
        WHERE id = ?
        `,
        [newRatingCount, newRatingSum, newRatingAvg, serviceId]
      );

      /* ---------------- 6️⃣ Bloquer modal ---------------- */
      await connection.query(
        `
        UPDATE reservations
        SET review_submitted = 1
        WHERE id = ?
        `,
        [reservationId]
      );

      /* ---------------- 7️⃣ 🔥 MARK NOTIF AS READ ---------------- */
      await connection.query(
        `
        UPDATE notifications
        SET is_read = 1, read_at = NOW()
        WHERE user_id = ?
          AND user_type = 'customer'
          AND type = 'review'
          AND reference_id = ?
        `,
        [customerId, reservationId]
      );

      await connection.commit();

      return res.status(201).json({
        ok: true,
        review: {
          serviceId,
          rating,
          comment,
        },
      });

    } catch (error) {
      await connection.rollback();
      console.error("[REVIEWS][CREATE]", error);
      return res.status(500).json({
        ok: false,
        error: "Erreur serveur",
      });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;