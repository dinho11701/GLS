const express = require("express");
const { query, param, validationResult } = require("express-validator");
const { DateTime } = require("luxon");
const db = require("../../config/mysql");
const authGuard = require("../../middleware/authGuard");

const router = express.Router();

/* ============================================================
   HELPER FUNCTIONS
============================================================ */

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      errors: errors.array(),
    });
  }
  return null;
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function parseRanges(val){

  if(!val) return [];

  if(typeof val === "object"){
    return val;
  }

  try{
    return JSON.parse(val);
  }catch{
    return [];
  }

}

/* ============================================================
   CHECK AVAILABILITY
============================================================ */

router.get(
"/check-availability",
authGuard,
[
query("serviceId").isString(),
query("date").isISO8601(),
query("startTime").matches(/^\d{2}:\d{2}$/),
query("endTime").matches(/^\d{2}:\d{2}$/),
],
async (req,res)=>{

if(handleValidation(req,res)) return;

try{

const { serviceId,date,startTime,endTime } = req.query;

/* 1️⃣ récupérer service */

const [svcRows] = await db.query(
`
SELECT id, partner_id
FROM services
WHERE id = ?
`,
[serviceId]
);

if(!svcRows.length){
return res.json({ ok:false, reason:"Service introuvable." });
}

const partnerId = svcRows[0].partner_id;

/* 2️⃣ récupérer disponibilités */

const [rows] = await db.query(
`
SELECT *
FROM partner_availability
WHERE partner_id = ?
`,
[partnerId]
);

if(!rows.length){
return res.json({ ok:false, reason:"Partenaire indisponible." });
}

/* 3️⃣ calcul jour */

const dt = DateTime.fromISO(date,{ zone:"America/Toronto" });
const weekday = dt.weekday;

/* 4️⃣ override */

const override = rows.find(
r => r.kind === "override" && r.specific_date === date
);

let ranges = [];

if(override){

if(override.is_closed){
return res.json({ ok:false, reason:"Partenaire fermé." });
}

ranges = parseRanges(override.ranges_json);
}else{

const weekly = rows.filter(
r => r.kind === "weekly" && r.day_of_week === weekday
);

ranges = weekly.flatMap(r =>
parseRanges(r.ranges_json)
);

if(!ranges.length){
return res.json({ ok:false, reason:"Partenaire fermé ce jour." });
}

}

/* 5️⃣ vérifier plage */

const startMin = timeToMinutes(startTime);
const endMin = timeToMinutes(endTime);

let valid = false;

for(const r of ranges){

const rStart = timeToMinutes(r.start);
const rEnd = timeToMinutes(r.end);

if(startMin >= rStart && endMin <= rEnd){
valid = true;
break;
}

}

if(!valid){
return res.json({
ok:false,
reason:"Horaire hors disponibilité."
});
}

/* 6️⃣ OK */

return res.json({ ok:true });

}catch(err){

console.error("check availability error",err);
return res.status(500).json({ ok:false });

}

});

/* ============================================================
   GET /customers/services/nearby
============================================================ */

router.get(
  "/nearby",
  [
    query("lat").isFloat(),
    query("lng").isFloat(),
    query("category").optional().isString(),
  ],
  async (req, res) => {

    if (handleValidation(req, res)) return;

    try {

      const { lat, lng, category } = req.query;

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      let sql = `
        SELECT
          s.id,
          s.title,
          s.description,
          s.fee,
          s.radius_km,
          s.available,
          s.status,
          s.category_id,
          c.slug,
          ST_Y(s.location) AS latitude,
          ST_X(s.location) AS longitude,
          ST_Distance_Sphere(
            POINT(ST_X(s.location), ST_Y(s.location)),
            POINT(?, ?)
          ) / 1000 AS distance_km
        FROM services s
        JOIN categories c ON s.category_id = c.id
        WHERE
          s.available = TRUE
          AND s.status = 'active'
      `;

      const params = [longitude, latitude];

      if (category && category !== "null" && category !== "undefined") {
        sql += ` AND c.slug = ?`;
        params.push(category);
      }

      sql += `
        AND ST_Distance_Sphere(
          POINT(ST_X(s.location), ST_Y(s.location)),
          POINT(?, ?)
        ) <= s.radius_km * 1000
        ORDER BY distance_km ASC
      `;

      params.push(longitude, latitude);

      console.log("NEARBY SQL:", sql);
      console.log("NEARBY PARAMS:", params);

      const [rows] = await db.execute(sql, params);

      return res.json({ ok: true, items: rows });

    } catch (err) {

      console.error("NEARBY ERROR", err);
      return res.status(500).json({ ok: false });

    }

  }
);

/* ============================================================
   GET /customers/services
============================================================ */

router.get("/", async (req, res) => {

  try {

    const {
      category,
      date,
      minFee,
      maxFee,
      q,
      sort = "created_at",
      dir = "desc",
      limit = 20
    } = req.query;

    /* ---------- SAFE SORT ---------- */

    const allowedSort = ["created_at", "fee"];
    const allowedDir = ["asc", "desc"];

    const safeSort = allowedSort.includes(sort) ? sort : "created_at";
    const safeDir = allowedDir.includes(dir) ? dir : "desc";

    const safeLimit = Math.min(parseInt(limit || 20, 10), 50);

    /* ---------- DATE ---------- */

    let searchDate = date;

    if (!searchDate) {
      const today = new Date();
      searchDate = today.toISOString().split("T")[0];
    }

    const parts = searchDate.split("-");
const d = new Date(parts[0], parts[1]-1, parts[2]);

let weekday = d.getDay();
weekday = weekday === 0 ? 7 : weekday;

console.log("SEARCH DATE:", searchDate)
console.log("WEEKDAY:", weekday)

    /* ---------- SQL BUILDER ---------- */

    let sql = `
      SELECT DISTINCT
        s.id,
        s.title,
        s.description,
        s.fee,
        s.category_id,
        c.slug,
        s.status,
        s.available,
        s.created_at
      FROM services s
      JOIN categories c ON s.category_id = c.id
      JOIN service_availability sa
        ON sa.service_id = s.id
        AND sa.weekday = ?
      WHERE
        s.status = 'active'
        AND s.available = TRUE
    `;

    const params = [weekday];

    /* ---------- CATEGORY ---------- */

    if (category && category !== "null" && category !== "undefined") {
      sql += ` AND c.slug = ?`;
      params.push(category);
    }

    /* ---------- CAPACITÉ JOURNALIÈRE ---------- */

sql += `
AND (
  SELECT COUNT(*)
  FROM reservations r
  WHERE r.service_id = s.id
  AND DATE(r.start_at) = ?
  AND r.status_id != 4
) < s.instances
`;

    params.push(searchDate);

    /* ---------- PRICE ---------- */

    if (minFee) {
      sql += ` AND s.fee >= ?`;
      params.push(Number(minFee));
    }

    if (maxFee) {
      sql += ` AND s.fee <= ?`;
      params.push(Number(maxFee));
    }

    /* ---------- SEARCH ---------- */

    if (q) {
      sql += ` AND (s.title LIKE ? OR s.description LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    /* ---------- ORDER ---------- */

    sql += ` ORDER BY s.${safeSort} ${safeDir} LIMIT ${safeLimit}`;

    /* ---------- DEBUG LOGS ---------- */

    console.log("SERVICES SQL:");
    console.log(sql);

    console.log("SERVICES PARAMS:");
    console.log(params);

    /* ---------- EXECUTE ---------- */

    const [rows] = await db.execute(sql, params);

    return res.json({
      ok: true,
      count: rows.length,
      items: rows
    });

  } catch (err) {

    console.error("LIST SERVICES ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Internal server error"
    });

  }

});

/* ============================================================
   GET /customers/services/:id
============================================================ */

router.get(
  "/:id",
  [param("id").isString()],
  async (req, res) => {

    if (handleValidation(req, res)) return;

    try {

      const { id } = req.params;

      const [rows] = await db.execute(
        `
        SELECT
  s.id,
  s.title,
  s.description,
  s.fee,
  s.category_id,
  s.status,
  s.available,
  s.created_at,
  sa.start_time,
  sa.end_time

FROM services s

LEFT JOIN service_availability sa
ON sa.service_id = s.id

WHERE s.id = ?
LIMIT 1
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          ok: false,
          message: "Service introuvable",
        });
      }
const item = rows[0];

item.availabilityStart = item.start_time;
item.availabilityEnd = item.end_time;

      return res.json({
        ok: true,
        item
      });

    } catch (err) {

      console.error("DETAIL ERROR", err);
      return res.status(500).json({ ok: false });

    }

  }
);

module.exports = router;