const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { DateTime } = require("luxon");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");

const router = express.Router();

/* ============================================================
   HELPERS
============================================================ */

function ensureValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ ok: false, errors: errors.array() });
    return true;
  }
  return false;
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function validateRangesNonOverlapping(ranges) {
  if (!Array.isArray(ranges)) return true;

  const sorted = [...ranges].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];

    if (timeToMinutes(r.end) <= timeToMinutes(r.start)) return false;

    if (
      i > 0 &&
      timeToMinutes(r.start) <
        timeToMinutes(sorted[i - 1].end)
    )
      return false;
  }

  return true;
}

function normalizeRanges(ranges = []) {
  const sorted = [...ranges].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const out = [];

  for (const r of sorted) {
    if (!out.length) {
      out.push({ start: r.start, end: r.end });
      continue;
    }

    const last = out[out.length - 1];

    if (timeToMinutes(r.start) === timeToMinutes(last.end)) {
      last.end = r.end;
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }

  return out;
}

/* ============================================================
   FETCH AVAILABILITY
============================================================ */
async function getAvailabilityRows(partnerId) {
  const [rows] = await dbPool.query(
    `
    SELECT *
    FROM partner_availability
    WHERE partner_id = ? AND is_active = 1
    `,
    [partnerId]
  );

  const weekly = rows.filter(r => r.kind === "weekly");
  const overrides = rows.filter(r => r.kind === "override");

  return { weekly, overrides, all: rows };
}

/* ============================================================
   CREATE SINGLE AVAILABILITY
============================================================ */
router.post(
  "/",
  authGuard,
  [
    body("kind").isIn(["weekly", "override"]),
    body("timezone").notEmpty(),
    body("ranges").optional().isArray(),
  ],
  async (req, res) => {
    if (ensureValid(req, res)) return;

    const partnerId = req.user.id;
    const p = req.body;

    try {
      if (!p.closed && !validateRangesNonOverlapping(p.ranges)) {
        return res.status(422).json({
          ok: false,
          error: "Plages horaires invalides.",
        });
      }

      const normalizedRanges = p.closed
        ? []
        : normalizeRanges(p.ranges || []);

      await dbPool.query(
        `
        INSERT INTO partner_availability (
          partner_id,
          kind,
          timezone,
          day_of_week,
          specific_date,
          is_closed,
          ranges_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          partnerId,
          p.kind,
          p.timezone,
          p.kind === "weekly" ? p.day : null,
          p.kind === "override" ? p.date : null,
          p.closed ? 1 : 0,
          JSON.stringify(normalizedRanges),
        ]
      );

      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[POST availability]", err);
      return res.status(500).json({ ok: false });
    }
  }
);

/* ============================================================
   PREVIEW
============================================================ */
router.get(
  "/preview",
  authGuard,
  [query("from").isISO8601(), query("to").isISO8601()],
  async (req, res) => {
    if (ensureValid(req, res)) return;

    const partnerId = req.user.id;

    const { weekly, overrides, all } =
      await getAvailabilityRows(partnerId);

    const timezone =
      all[0]?.timezone || "America/Toronto";

    const days = [];

    let cursor = DateTime.fromISO(req.query.from, {
      zone: timezone,
    });

    const end = DateTime.fromISO(req.query.to, {
      zone: timezone,
    });

    while (cursor <= end) {
      const isoDate = cursor.toISODate();
      const isoDay = cursor.weekday;

      const weeklyMatches = weekly.filter(
        w => w.day_of_week === isoDay
      );

      let ranges = weeklyMatches.flatMap(w =>
        JSON.parse(w.ranges_json || "[]")
      );

      let closed = ranges.length === 0;

      const overrideMatch = overrides.find(
        o => o.specific_date === isoDate
      );

      if (overrideMatch) {
        closed = !!overrideMatch.is_closed;
        ranges = closed
          ? []
          : JSON.parse(overrideMatch.ranges_json || "[]");
      }

      days.push({
        date: isoDate,
        closed,
        ranges,
      });

      cursor = cursor.plus({ days: 1 });
    }

    return res.json({ ok: true, timezone, days });
  }
);

/* ============================================================
   BULK REPLACE
============================================================ */
router.put("/bulk", authGuard, async (req, res) => {
  const partnerId = req.user.id;
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    /* Désactiver anciennes */
    await connection.query(
      `
      DELETE FROM partner_availability
WHERE partner_id = ?
      `,
      [partnerId]
    );

    /* Insérer nouvelles */
    for (const doc of req.body.items || []) {
      await connection.query(
        `
        INSERT INTO partner_availability (
          partner_id,
          kind,
          timezone,
          day_of_week,
          specific_date,
          is_closed,
          ranges_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          partnerId,
          doc.kind,
          doc.timezone,
          doc.day || null,
          doc.date || null,
          doc.closed ? 1 : 0,
          JSON.stringify(doc.ranges || []),
        ]
      );
    }

    await connection.commit();

    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    console.error("[BULK availability]", err);
    return res.status(500).json({ ok: false });
  } finally {
    connection.release();
  }
});

module.exports = router;