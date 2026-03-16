const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");

const router = express.Router();

/* ============================================================
   GET /api/v1/partners/reservations
============================================================ */
router.get(
  "/",
  authGuard,
  [
    query("status").optional().isString(),
    query("includeCancelled").optional().isIn(["0", "1"]),
  ],
  async (req, res) => {
    try {
      const partnerId = req.user.id;
      const { status, includeCancelled } = req.query;

      let sql = `
        SELECT
          r.id,
          r.reservation_uuid,
          r.start_at,
          r.end_at,
          r.duration_minutes,
          r.base_amount,
          r.tax_amount,
          r.total_amount,
          r.review_submitted,
          r.created_at,
          rs.code  AS status_code,
          rs.label AS status_label,
          c.code   AS currency_code,
          c.symbol AS currency_symbol,
          s.title  AS service_title
        FROM reservations r
        JOIN reservation_statuses rs ON r.status_id = rs.id
        JOIN currencies c            ON r.currency_id = c.id
        LEFT JOIN services s         ON r.service_id = s.id
        WHERE r.partner_id = ?
      `;

      const params = [partnerId];

      if (status) {
        sql += " AND rs.code = ?";
        params.push(status);
      } else if (includeCancelled !== "1") {
        sql += " AND rs.code != 'cancelled'";
      }

      sql += " ORDER BY r.start_at DESC";

      const [rows] = await dbPool.query(sql, params);

      const reservations = rows.map(r => ({
        uuid: r.reservation_uuid,
        serviceTitle: r.service_title,
        status: r.status_code,
        statusLabel: r.status_label,
        currency: r.currency_code,
        currencySymbol: r.currency_symbol,
        baseAmount: Number(r.base_amount),
        taxAmount: Number(r.tax_amount),
        totalAmount: Number(r.total_amount),
        durationMinutes: r.duration_minutes,
        reviewSubmitted: !!r.review_submitted,
        startAtISO: new Date(r.start_at).toISOString(),
        endAtISO: new Date(r.end_at).toISOString(),
        createdAt: r.created_at,
      }));

      res.json({ reservations });

    } catch (err) {
      console.error("[PARTNER][RESERVATIONS][LIST]", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

router.patch(
  "/:uuid",
  authGuard,
  [
    param("uuid").isUUID(),
    body("durationMinutes").optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const partnerId = req.user.id;
      const { uuid } = req.params;
      const { durationMinutes } = req.body;

      const [rows] = await dbPool.query(
        `
        SELECT id, partner_id
        FROM reservations
        WHERE reservation_uuid = ?
        `,
        [uuid]
      );

      if (!rows.length)
        return res.status(404).json({ error: "Réservation introuvable" });

      if (rows[0].partner_id !== partnerId)
        return res.status(403).json({ error: "Accès interdit" });

      await dbPool.query(
        `
        UPDATE reservations
        SET duration_minutes = COALESCE(?, duration_minutes),
            updated_at = NOW()
        WHERE reservation_uuid = ?
        `,
        [durationMinutes || null, uuid]
      );

      res.json({ success: true, uuid });

    } catch (err) {
      console.error("[PATCH UPDATE]", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

module.exports = router;