// routes/partners/payments.js
const express = require("express");
const { query, validationResult } = require("express-validator");
const { db } = require("../../config/firebase");
const authGuard = require("../../middleware/authGuard");
const Stripe = require("stripe");

const router = express.Router();

/* -------------------------------------------------------
   STRIPE INIT — FAIL FAST
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
   BILLING SUMMARY (FIRESTORE SOURCE OF TRUTH)
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
      const partnerUid = req.user?.uid;
      if (!partnerUid) return res.status(403).json({ error: "Forbidden" });

      const from = parseDate(req.query.from);
      const toRaw = parseDate(req.query.to);
      const to = toRaw
        ? new Date(toRaw.setHours(23, 59, 59, 999))
        : null;

      const limit = Number(req.query.limit || 10);

      const snap = await db
        .collection("payments")
        .where("partnerUid", "==", partnerUid)
        .where("status", "==", "succeeded")
        .orderBy("createdAt", "desc")
        .limit(500)
        .get();

      let total = 0;
      let count = 0;
      const sample = [];

      snap.forEach((doc) => {
        const d = doc.data();
        const ts = d.createdAt?.toDate?.() ?? new Date(d.createdAt);

        if (from && ts < from) return;
        if (to && ts > to) return;

        count++;
        total += Number(d.amount || 0);

        if (sample.length < limit) {
          sample.push({
            id: doc.id,
            serviceId: d.serviceId,
            amount: d.amount,
            currency: d.currency,
            createdAt: d.createdAt,
            status: d.status,
          });
        }
      });

      return res.json({
        totals: {
          count,
          amount: total,
          currency: sample[0]?.currency || "CAD",
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
   PAYOUTS OVERVIEW (STRIPE CONNECT REQUIRED)
------------------------------------------------------- */
router.get("/payouts/overview", authGuard, async (req, res) => {
  try {
    if (!stripe)
      return res
        .status(503)
        .json({ error: "Stripe not configured on server." });

    const partnerUid = req.user?.uid;
    if (!partnerUid) return res.status(403).json({ error: "Forbidden" });

    const partnerDoc = await db.collection("partners").doc(partnerUid).get();
    if (!partnerDoc.exists)
      return res.status(404).json({ error: "Partner not found" });

    const { stripe_account_id } = partnerDoc.data();
    if (!stripe_account_id) {
      return res.json({
        connect: { connected: false },
        message: "Stripe account not connected.",
      });
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: stripe_account_id,
    });

    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: stripe_account_id }
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
    if (!stripe)
      return res.status(503).json({ error: "Stripe not configured." });

    const partnerUid = req.user?.uid;
    if (!partnerUid) return res.status(403).json({ error: "Forbidden" });

    const partnerDoc = await db.collection("partners").doc(partnerUid).get();
    if (!partnerDoc.exists)
      return res.status(404).json({ error: "Partner not found" });

    const { stripe_account_id } = partnerDoc.data();
    if (!stripe_account_id)
      return res.status(400).json({ error: "Stripe not connected" });

    const payout = await stripe.payouts.retrieve(req.params.id, {
      stripeAccount: stripe_account_id,
    });

    return res.json({ payout });
  } catch (err) {
    console.error("[PAYOUTS][GET][ERROR]", err);
    return res.status(500).json({ error: "Unable to fetch payout." });
  }
});

module.exports = router;