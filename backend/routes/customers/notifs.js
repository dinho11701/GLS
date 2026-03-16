const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");
const { DateTime } = require("luxon");

const router = express.Router();
const reservationScoped = express.Router({ mergeParams: true });

const ALLOWED_TYPES = ["reservation", "message", "payment"];

/* ============================================================
   VALIDATION HELPER
============================================================ */
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

/* ============================================================
   LIST NOTIFICATIONS
============================================================ */
router.get(
  "/",
  authGuard,
  [
    query("status").optional().isIn(["unread", "read"]),
    query("type").optional().isIn(ALLOWED_TYPES),
    query("limit").optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const userId = req.user.id;
    const { status, type, limit = 50 } = req.query;

    try {
      let sql = `SELECT * FROM notifications WHERE user_id = ?`;
      const params = [userId];

      if (status) {
        sql += ` AND is_read = ?`;
        params.push(status === "read" ? 1 : 0);
      }

      if (type) {
        sql += ` AND type = ?`;
        params.push(type);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(Number(limit));

      const [rows] = await dbPool.query(sql, params);
      res.json({ items: rows });
    } catch (err) {
      console.error("[LIST NOTIFS ERROR]", err);
      res.status(500).json({ error: "LIST_FAILED" });
    }
  }
);

/* ============================================================
   COUNTERS
============================================================ */
router.get("/counters", authGuard, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await dbPool.query(
      `
      SELECT type, COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
      GROUP BY type
      `,
      [userId]
    );

    const counters = {
      total: 0,
      byType: {
        reservation: 0,
        message: 0,
        payment: 0,
      },
    };

    rows.forEach((row) => {
      counters.total += row.count;
      counters.byType[row.type] = row.count;
    });

    res.json(counters);
  } catch (err) {
    console.error("[COUNTERS ERROR]", err);
    res.status(500).json({ error: "COUNTERS_FAILED" });
  }
});

/* ============================================================
   CREATE GENERIC NOTIFICATION
============================================================ */
router.post(
  "/",
  authGuard,
  [
    body("type").isIn(ALLOWED_TYPES),
    body("title").isString().isLength({ min: 1, max: 150 }),
    body("message").optional().isString(),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const userId = req.user.id;
    const { type, title, message } = req.body;

    try {
      const [result] = await dbPool.query(
        `
        INSERT INTO notifications
        (user_id, user_type, type, title, message, is_read)
        VALUES (?, 'customer', ?, ?, ?, 0)
        `,
        [userId, type, title, message || ""]
      );

      res.status(201).json({
        id: result.insertId,
        type,
        title,
        message,
        is_read: 0,
      });
    } catch (err) {
      console.error("[CREATE NOTIF ERROR]", err);
      res.status(500).json({ error: "CREATE_FAILED" });
    }
  }
);

/* ============================================================
   MARK AS READ
============================================================ */
router.patch("/:id/read", authGuard, async (req, res) => {
  const userId = req.user.id;
  const notifId = req.params.id;

  try {
    const [result] = await dbPool.query(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
      `,
      [notifId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[MARK READ ERROR]", err);
    res.status(500).json({ error: "MARK_READ_FAILED" });
  }
});

/* ============================================================
   MARK ALL AS READ
============================================================ */
router.patch("/read-all", authGuard, async (req, res) => {
  const userId = req.user.id;

  try {
    const [result] = await dbPool.query(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
      `,
      [userId]
    );

    res.json({ ok: true, updated: result.affectedRows });
  } catch (err) {
    console.error("[READ ALL ERROR]", err);
    res.status(500).json({ error: "READ_ALL_FAILED" });
  }
});

/* ============================================================
   DELETE
============================================================ */
router.delete("/:id", authGuard, async (req, res) => {
  const userId = req.user.id;
  const notifId = req.params.id;

  try {
    await dbPool.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [notifId, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE ERROR]", err);
    res.status(500).json({ error: "DELETE_FAILED" });
  }
});

/* ============================================================
   RESERVATION SCOPED
============================================================ */
reservationScoped.post(
  "/:reservationUuid/notifs",
  authGuard,
  async (req, res) => {
    const userId = req.user.id;
    const reservationUuid = req.params.reservationUuid;

    try {
      const [rows] = await dbPool.query(
        `
        SELECT start_at
        FROM reservations
        WHERE reservation_uuid = ? AND customer_id = ?
        `,
        [reservationUuid, userId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "RESERVATION_NOT_FOUND" });
      }

      const formattedDate = DateTime.fromJSDate(rows[0].start_at)
        .setLocale("fr")
        .toFormat("cccc d LLLL yyyy 'à' HH:mm");

      const message = `Votre réservation est confirmée pour ${formattedDate}.`;

      await dbPool.query(
        `
        INSERT INTO notifications
        (user_id, user_type, type, title, message, reference_id, is_read)
        VALUES (?, 'customer', 'reservation', ?, ?, ?, 0)
        `,
        [userId, "Réservation confirmée", message, reservationUuid]
      );

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[RESERVATION NOTIF ERROR]", err);
      res.status(500).json({ error: "CREATE_FOR_RESERVATION_FAILED" });
    }
  }
);

module.exports = router;
module.exports.reservationScoped = reservationScoped;