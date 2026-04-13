const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const pool = require("../../config/mysql");

const router = express.Router();

/* -------------------- helpers -------------------- */

function handleValidation(req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({ errors: result.array() });
  }
}

function convIdOf({ customerId, partnerId, serviceId }) {
  const sid = serviceId ? String(serviceId) : "general";
  return `c_${customerId}__p_${partnerId}__s_${sid}`;
}

/* -------------------- CREATE / GET CONVERSATION -------------------- */

router.post(
  "/conversations",
  authGuard,
  [
    body("customerId").isInt(),
    body("serviceId").optional().isString(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res);
    if (bad) return bad;

    const partnerId = req.user.id;
    const { customerId, serviceId } = req.body;

    const conversationId = convIdOf({
      customerId,
      partnerId,
      serviceId,
    });

    try {
      const [rows] = await pool.query(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId]
      );

      if (!rows.length) {
        await pool.query(
          `
          INSERT INTO conversations
          (id, customer_id, partner_id, service_id)
          VALUES (?, ?, ?, ?)
          `,
          [conversationId, customerId, partnerId, serviceId || null]
        );
      }

      const [conv] = await pool.query(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId]
      );

      return res.json({ conversation: conv[0] });

    } catch (err) {
      console.error("[P-CONV][ERROR]", err);
      return res.status(500).json({ error: "Failed to create conversation" });
    }
  }
);

/* -------------------- LIST CONVERSATIONS -------------------- */

router.get("/conversations", authGuard, async (req, res) => {
  const partnerId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM conversations
      WHERE partner_id = ?
      ORDER BY updated_at DESC
      LIMIT 20
      `,
      [partnerId]
    );

    return res.json({ conversations: rows });

  } catch (err) {
    console.error("[P-CONV LIST][ERROR]", err);
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

/* -------------------- SEND MESSAGE -------------------- */

router.post(
  "/conversations/:conversationId/messages",
  authGuard,
  [
    param("conversationId").isString(),
    body("text").isString().trim().notEmpty(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res);
    if (bad) return bad;

    const { conversationId } = req.params;
    const { text } = req.body;
    const partnerId = req.user.id;

    try {
      const [convRows] = await pool.query(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId]
      );

      if (!convRows.length) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const conv = convRows[0];

      if (conv.partner_id !== partnerId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [msgResult] = await pool.query(
        `
        INSERT INTO messages
        (conversation_id, sender_id, sender_role, text)
        VALUES (?, ?, 'partner', ?)
        `,
        [conversationId, partnerId, text]
      );

      await pool.query(
        `
        UPDATE conversations
        SET last_message = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [text, conversationId]
      );

      return res.status(201).json({
        message: {
          id: msgResult.insertId,
          text,
          sender_id: partnerId,
          sender_role: "partner",
        },
      });

    } catch (err) {
      console.error("[P-SEND MESSAGE][ERROR]", err);
      return res.status(500).json({ error: "Failed to send message" });
    }
  }
);

/* -------------------- LIST MESSAGES -------------------- */

router.get(
  "/conversations/:conversationId/messages",
  authGuard,
  async (req, res) => {
    const { conversationId } = req.params;
    const partnerId = req.user.id;

    try {
      const [convRows] = await pool.query(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId]
      );

      if (!convRows.length) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (convRows[0].partner_id !== partnerId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [messages] = await pool.query(
        `
        SELECT *
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [conversationId]
      );

      return res.json({ messages });

    } catch (err) {
      console.error("[P-LIST MESSAGES][ERROR]", err);
      return res.status(500).json({ error: "Failed to list messages" });
    }
  }
);

module.exports = router;