const express = require("express");
const { param, body, validationResult } = require("express-validator");
const dbPool = require("../../config/mysql");
const { v4: uuidv4 } = require("uuid");
const Stripe = require("stripe");

const router = express.Router();

/* ---------- Vérification clé Stripe ---------- */

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("[FATAL] STRIPE_SECRET_KEY missing in .env");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});


console.log("Stripe key:", process.env.STRIPE_SECRET_KEY?.slice(0,15));


/* ============================================================
   POST /partners/refunds/:uuid/refund
============================================================ */

router.post(
  "/:uuid/refund",
  [
    param("uuid").isUUID(),
    body("amount").optional().isFloat({ min: 0.01 }),
    body("reason").optional().isString()
  ],
  async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const connection = await dbPool.getConnection();

    try {

      const partnerId = req.user.id;
      const { uuid } = req.params;
      const { amount, reason } = req.body;

      await connection.beginTransaction();

      /* ============================================================
         1️⃣ LOCK réservation
      ============================================================ */

      const [resa] = await connection.query(
        `
        SELECT r.*, s.code AS status_code
        FROM reservations r
        JOIN reservation_statuses s ON r.status_id = s.id
        WHERE r.reservation_uuid = ?
        FOR UPDATE
        `,
        [uuid]
      );

      if (!resa.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Réservation introuvable" });
      }

      const reservation = resa[0];

      /* ============================================================
         2️⃣ sécurité partenaire
      ============================================================ */

      if (reservation.partner_id !== partnerId) {
        await connection.rollback();
        return res.status(403).json({ error: "Accès interdit" });
      }

      if (reservation.status_code !== "confirmed") {
        await connection.rollback();
        return res.status(400).json({ error: "Réservation non remboursable" });
      }

      /* ============================================================
         3️⃣ vérifier montant déjà remboursé
      ============================================================ */

      const [existingRefunds] = await connection.query(
        `
        SELECT SUM(amount) AS refunded
        FROM refunds
        WHERE reservation_id = ?
        `,
        [reservation.id]
      );

      const alreadyRefunded = existingRefunds[0].refunded || 0;

      const refundAmount = amount || reservation.total_amount - alreadyRefunded;

      if (refundAmount <= 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (alreadyRefunded + refundAmount > reservation.total_amount) {
        await connection.rollback();
        return res.status(400).json({
          error: "Montant dépasse paiement"
        });
      }

      /* ============================================================
         4️⃣ Stripe refund
      ============================================================ */

      let stripeRefund = null;

      if (reservation.stripe_payment_intent_id) {

        stripeRefund = await stripe.refunds.create({
          payment_intent: reservation.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reason: "requested_by_customer"
        });

      }

      /* ============================================================
         5️⃣ insert refund
      ============================================================ */

      const refundUuid = uuidv4();

      await connection.query(
        `
        INSERT INTO refunds (
          refund_uuid,
          reservation_id,
          partner_id,
          amount,
          currency_id,
          reason,
          stripe_refund_id,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'processed', NOW())
        `,
        [
          refundUuid,
          reservation.id,
          partnerId,
          refundAmount,
          reservation.currency_id,
          reason || null,
          stripeRefund ? stripeRefund.id : null
        ]
      );

      /* ============================================================
         6️⃣ update statut réservation
      ============================================================ */

      const totalAfterRefund = alreadyRefunded + refundAmount;

      if (totalAfterRefund >= reservation.total_amount) {

        await connection.query(
          `
          UPDATE reservations
          SET status_id = (
            SELECT id FROM reservation_statuses
            WHERE code = 'refunded'
          )
          WHERE id = ?
          `,
          [reservation.id]
        );

      }

      /* ============================================================
         7️⃣ audit log
      ============================================================ */

      await connection.query(
        `
        INSERT INTO audit_logs (
          entity_type,
          entity_id,
          action,
          actor_id,
          metadata,
          created_at
        )
        VALUES ('reservation', ?, 'refund_created', ?, ?, NOW())
        `,
        [
          reservation.id,
          partnerId,
          JSON.stringify({
            refundUuid,
            amount: refundAmount
          })
        ]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        refundUuid,
        amount: refundAmount,
        stripeRefundId: stripeRefund ? stripeRefund.id : null
      });

    } catch (err) {

      await connection.rollback();

      console.error("[REFUND ERROR]", err);

      res.status(500).json({
        error: "Erreur serveur"
      });

    } finally {

      connection.release();

    }

  }
);

module.exports = router;