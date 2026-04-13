const express = require("express");
const { body, param, validationResult } = require("express-validator");
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

router.post("/conversations", authGuard, async (req, res) => {
  const customerId = req.user.id;
  const { partnerId, serviceId } = req.body;

  const conversationId = convIdOf({ customerId, partnerId, serviceId });

  try {
    const [rows] = await pool.query(
      `SELECT * FROM conversations WHERE id = ?`,
      [conversationId]
    );

    if (!rows.length) {
      await pool.query(
        `INSERT INTO conversations (id, customer_id, partner_id, service_id)
         VALUES (?, ?, ?, ?)`,
        [conversationId, customerId, partnerId, serviceId || null]
      );
    }

    const [conv] = await pool.query(
      `SELECT * FROM conversations WHERE id = ?`,
      [conversationId]
    );

    return res.json({ conversation: conv[0] });

  } catch (err) {
    console.error("[CONV][ERROR]", err);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

/* -------------------- LIST CONVERSATIONS -------------------- */

router.get("/conversations", authGuard, async (req, res) => {
  const customerId = req.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM conversations
       WHERE customer_id = ?
       ORDER BY updated_at DESC
       LIMIT 20`,
      [customerId]
    );

    return res.json({ conversations: rows });

  } catch (err) {
    console.error("[CONV LIST][ERROR]", err);
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

/* -------------------- SEND MESSAGE -------------------- */

router.post(
  "/conversations/:conversationId/messages",
  authGuard,
  async (req, res) => {
    const { conversationId } = req.params;
    const { text } = req.body;
    const customerId = req.user.id;

    try {
      const [convRows] = await pool.query(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId]
      );

      if (!convRows.length) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const conv = convRows[0];

      if (conv.customer_id !== customerId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [msgResult] = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, sender_role, text)
         VALUES (?, ?, 'customer', ?)`,
        [conversationId, customerId, text]
      );

      await pool.query(
        `UPDATE conversations
         SET last_message = ?,
             updated_at = NOW(),
             unread_partner = unread_partner + 1,
             last_sender_role = 'customer'
         WHERE id = ?`,
        [text, conversationId]
      );

      return res.status(201).json({
        message: {
          id: msgResult.insertId,
          text,
          sender_id: customerId,
          sender_role: "customer",
        },
      });

    } catch (err) {
      console.error("[SEND MESSAGE][ERROR]", err);
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
    const customerId = req.user.id;

    try {
      const [convRows] = await pool.query(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId]
      );

      if (!convRows.length) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (convRows[0].customer_id !== customerId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [messages] = await pool.query(
        `SELECT * FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [conversationId]
      );

      return res.json({ messages });

    } catch (err) {
      console.error("[LIST MESSAGES][ERROR]", err);
      return res.status(500).json({ error: "Failed to list messages" });
    }
  }
);

/* -------------------- MARK AS READ -------------------- */

router.post(
  "/conversations/:conversationId/read",
  authGuard,
  async (req, res) => {
    const { conversationId } = req.params;
    const customerId = req.user.id;

    try {
      await pool.query(
        `UPDATE conversations
         SET unread_customer = 0
         WHERE id = ? AND customer_id = ?`,
        [conversationId, customerId]
      );

      return res.json({ ok: true });

    } catch (err) {
      console.error("[READ][ERROR]", err);
      return res.status(500).json({ error: "Failed to mark read" });
    }
  }
);

/* -------------------- TYPING -------------------- */

router.post(
  "/conversations/:conversationId/typing",
  authGuard,
  async (req, res) => {
    const { conversationId } = req.params;
    const { typing } = req.body;
    const customerId = req.user.id;

    try {
      await pool.query(
        `UPDATE conversations
         SET typing_customer = ?
         WHERE id = ? AND customer_id = ?`,
        [typing ? 1 : 0, conversationId, customerId]
      );

      return res.json({ ok: true });

    } catch (err) {
      console.error("[TYPING][ERROR]", err);
      return res.status(500).json({ error: "Failed to update typing" });
    }
  }
);

module.exports = router;