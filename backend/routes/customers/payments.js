const express = require("express");
const { body, query, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const Stripe = require("stripe");
const pool = require("../../config/mysql");

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_missing", {
  apiVersion: "2024-06-20",
});


/* ---------------------------------------------------- */

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
}

/* ---------------------------------------------------- */
/* PING */
/* ---------------------------------------------------- */

router.get("/_ping", (_req, res) => {
  res.json({ ok: true });
});

/* ---------------------------------------------------- */
/* CREATE PAYMENT INTENT */
/* ---------------------------------------------------- */

router.post(
  "/intents",
  authGuard,
  [
    body("amount").isInt({ min: 50 }),
    body("currency").isString().isLength({ min: 3, max: 3 }),
    body("Service_ID").isString(),
  ],
  async (req, res) => {

    const v = handleValidation(req, res);
    if (v) return v;

    try {

      const { amount, currency, Service_ID } = req.body;
      const Client_ID = req.user.id;

      /* ------------------------------------------------ */
      /* GET SERVICE INFO                                 */
      /* ------------------------------------------------ */

      const [serviceRows] = await pool.query(
        `SELECT partner_id, fee FROM services WHERE id = ?`,
        [Service_ID]
      );

      if (!serviceRows.length) {
        return res.status(404).json({ error: "Service not found" });
      }

      const service = serviceRows[0];

      const partnerId = service.partner_id;
      const baseAmount = Number(service.fee);

      const taxAmount = 0;
      const totalAmount = baseAmount + taxAmount;

/* ------------------------------------------------ */
/* GET CURRENCY ID                                  */
/* ------------------------------------------------ */

const [currencyRows] = await pool.query(
  `SELECT id FROM currencies WHERE code = ? LIMIT 1`,
  [currency.toUpperCase()]
);

if (!currencyRows.length) {
  return res.status(400).json({ error: "Currency not supported" });
}

const currencyId = currencyRows[0].id;


const [statusRows] = await pool.query(
  `SELECT id FROM reservation_statuses WHERE code = 'pending' LIMIT 1`
);

if (!statusRows.length) {
  return res.status(500).json({ error: "Missing reservation status" });
}

const statusId = statusRows[0].id;

      /* ------------------------------------------------ */
      /* CREATE RESERVATION                               */
      /* ------------------------------------------------ */

      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000);

      const [reservationResult] = await pool.query(
  `
  INSERT INTO reservations
  (
    reservation_uuid,
    customer_id,
    partner_id,
    service_id,
    status_id,
    currency_id,
    base_amount,
    tax_amount,
    total_amount,
    start_at,
    end_at
  )
  VALUES
  (
    UUID(),
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
  `,
  [
    Client_ID,
    partnerId,
    Service_ID,
    statusId,            // ou statusId si tu fais version propre
    currencyId,   // ✅ FIX IMPORTANT
    baseAmount,
    taxAmount,
    totalAmount,
    now,
    end
  ]
);

      const reservationId = reservationResult.insertId;

      /* ------------------------------------------------ */
      /* STRIPE PAYMENT INTENT                            */
      /* ------------------------------------------------ */

      const pi = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: currency.toLowerCase(),
        metadata: {
          reservation_id: reservationId,
          customer_id: Client_ID
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      });

console.log("✅ PI CREATED:", pi.id);
console.log("✅ CLIENT SECRET:", pi.client_secret);


      /* ------------------------------------------------ */
      /* STRIPE CHECKOUT WEB                              */
      /* ------------------------------------------------ */

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Service ${Service_ID}`,
              },
              unit_amount: Math.round(amount),
            },
            quantity: 1,
          },
        ],
        metadata: {
          reservation_id: reservationId,
          customer_id: Client_ID
        },
        success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/payment-cancel`,
      });

      /* ------------------------------------------------ */
      /* INSERT PAYMENT                                   */
      /* ------------------------------------------------ */

      await pool.query(
        `
        INSERT INTO payments
        (
          payment_uuid,
          reservation_id,
          stripe_payment_intent_id,
          amount,
          currency_id,
          status
        )
        VALUES
        (
          UUID(),
          ?,
          ?,
          ?,
          ?,
          'pending'
        )
        `,
        [
          reservationId,
          pi.id,
          totalAmount,
	  currencyId
        ]
      );

      /* ------------------------------------------------ */
      /* RESPONSE                                         */
      /* ------------------------------------------------ */

      return res.status(201).json({
        payment_intent: {
          id: pi.id,
          client_secret: pi.client_secret,
          status: pi.status,
        },
        checkoutUrl: session.url,
      });

    } catch (err) {

      console.error("[PAYMENTS][INTENTS][ERROR]", err);

      res.status(500).json({
        error: "Unable to create payment intent."
      });

    }
  }
);

/* ---------------------------------------------------- */
/* PAYMENT HISTORY                                      */
/* ---------------------------------------------------- */

router.get(
  "/history",
  authGuard,
  [query("limit").optional().isInt({ min: 1, max: 50 })],
  async (req, res) => {

    try {

      const clientId = req.user.id;
      const limit = Number(req.query.limit || 20);

      const [rows] = await pool.query(
        `
        SELECT p.*
        FROM payments p
        JOIN reservations r ON p.reservation_id = r.id
        WHERE r.customer_id = ?
        ORDER BY p.created_at DESC
        LIMIT ?
        `,
        [clientId, limit]
      );

      res.json({ payments: rows });

    } catch (err) {

      console.error("[PAYMENTS][HISTORY][ERROR]", err);

      res.status(500).json({
        error: "Unable to fetch payment history."
      });

    }
  }
);

/* ---------------------------------------------------- */
/* DEV CONFIRM PAYMENT                                  */
/* ---------------------------------------------------- */

router.post("/intents/:id/confirm", authGuard, async (req, res) => {

  try {

    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Not allowed in production" });
    }

    const id = req.params.id;

    const confirmed = await stripe.paymentIntents.confirm(id, {
      payment_method: "pm_card_visa",
    });

    await pool.query(
      `
      UPDATE payments
      SET status = ?
      WHERE stripe_payment_intent_id = ?
      `,
      [confirmed.status, id]
    );

    res.json({ payment_intent: confirmed });

  } catch (err) {

    console.error("[PAYMENTS][CONFIRM][ERROR]", err);

    res.status(500).json({
      error: "Unable to confirm payment."
    });

  }
});

module.exports = router;