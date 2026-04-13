const express = require("express");
const { query, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const Stripe = require("stripe");
const pool = require("../../config/mysql");

const router = express.Router();

/* -------------------------------------------------------
   STRIPE INIT
------------------------------------------------------- */
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("[FATAL] STRIPE_SECRET_KEY missing");
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

function parseDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

/* -------------------------------------------------------
   HEALTHCHECK
------------------------------------------------------- */
router.get("/_ping", (_req, res) =>
  res.json({ ok: true, scope: "partners-payments" })
);

/* -------------------------------------------------------
   BILLING SUMMARY (MYSQL)
------------------------------------------------------- */
router.get(
  "/billing/summary",
  authGuard,
  [
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    query("limit").optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const partnerId = req.user.id;

      const from = parseDate(req.query.from);
      const toRaw = parseDate(req.query.to);
      const to = toRaw
        ? new Date(toRaw.setHours(23, 59, 59, 999))
        : null;

      const limit = Number(req.query.limit || 10);

      let query = `
        SELECT p.*, r.service_id
        FROM payments p
        JOIN reservations r ON p.reservation_id = r.id
        WHERE r.partner_id = ?
        AND p.status = 'succeeded'
      `;

      const params = [partnerId];

      if (from) {
        query += " AND p.created_at >= ?";
        params.push(from);
      }

      if (to) {
        query += " AND p.created_at <= ?";
        params.push(to);
      }

      query += " ORDER BY p.created_at DESC LIMIT 500";

      const [rows] = await pool.query(query, params);

      let total = 0;
      let count = 0;

      const sample = [];

      for (const row of rows) {
        count++;
        total += Number(row.amount || 0);

        if (sample.length < limit) {
          sample.push({
            id: row.id,
            serviceId: row.service_id,
            amount: row.amount,
            currency_id: row.currency_id,
            createdAt: row.created_at,
            status: row.status,
          });
        }
      }

      return res.json({
        totals: {
          count,
          amount: total,
          currency: "CAD",
        },
        sample,
      });

    } catch (err) {
      console.error("[BILLING][SUMMARY][ERROR]", err);
      return res.status(500).json({ error: "Unable to fetch billing summary." });
    }
  }
);

/* -------------------------------------------------------
   PAYOUTS OVERVIEW (MYSQL + STRIPE)
------------------------------------------------------- */
router.get("/payouts/overview", authGuard, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe not configured." });
    }

    const partnerId = req.user.id;

    // 🔥 récupère stripe_account_id depuis MySQL
    const [rows] = await pool.query(
      `SELECT stripe_account_id FROM partners WHERE id = ? LIMIT 1`,
      [partnerId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Partner not found" });
    }

    const stripeAccountId = rows[0].stripe_account_id;

    if (!stripeAccountId) {
      return res.json({
        connect: { connected: false },
        message: "Stripe account not connected.",
      });
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });

    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: stripeAccountId }
    );

    return res.json({
      connect: { connected: true },
      balance,
      payouts: payouts.data,
    });

  } catch (err) {
    console.error("[PAYOUTS][OVERVIEW][ERROR]", err);
    return res.status(500).json({ error: "Unable to fetch payouts." });
  }
});

/* -------------------------------------------------------
   PAYOUT DETAIL
------------------------------------------------------- */
router.get("/payouts/:id", authGuard, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe not configured." });
    }

    const partnerId = req.user.id;

    const [rows] = await pool.query(
      `SELECT stripe_account_id FROM partners WHERE id = ? LIMIT 1`,
      [partnerId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Partner not found" });
    }

    const stripeAccountId = rows[0].stripe_account_id;

    if (!stripeAccountId) {
      return res.status(400).json({ error: "Stripe not connected" });
    }

    const payout = await stripe.payouts.retrieve(req.params.id, {
      stripeAccount: stripeAccountId,
    });

    return res.json({ payout });

  } catch (err) {
    console.error("[PAYOUTS][GET][ERROR]", err);
    return res.status(500).json({ error: "Unable to fetch payout." });
  }
});

module.exports = router;