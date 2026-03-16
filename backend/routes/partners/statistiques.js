const express = require("express");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");

const router = express.Router();

/* ============================================================
   GET /partners/dashboard/revenue
============================================================ */
router.get("/revenue", authGuard, async (req, res) => {
  try {
    const partnerId = req.user.id;

    const [globalStats] = await dbPool.query(
      `
      SELECT
        COUNT(*) AS totalReservations,
        SUM(base_amount) AS totalBase,
        SUM(tax_amount) AS totalTaxes,
        SUM(total_amount) AS totalRevenue
      FROM reservations r
      JOIN reservation_statuses s ON r.status_id = s.id
      WHERE r.partner_id = ?
      AND s.code = 'confirmed'
      `,
      [partnerId]
    );

    const [monthly] = await dbPool.query(
      `
      SELECT
        DATE_FORMAT(start_at, '%Y-%m') AS month,
        COUNT(*) AS reservations,
        SUM(total_amount) AS revenue
      FROM reservations r
      JOIN reservation_statuses s ON r.status_id = s.id
      WHERE r.partner_id = ?
      AND s.code = 'confirmed'
      GROUP BY month
      ORDER BY month DESC
      `,
      [partnerId]
    );

    res.json({
      global: globalStats[0],
      monthly,
    });

  } catch (err) {
    console.error("[DASHBOARD][REVENUE]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;