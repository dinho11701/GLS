// backend/routes/partners/services.js

const express = require("express");
const { body, param, validationResult } = require("express-validator");
const db = require("../../config/mysql");
const authGuard = require("../../middleware/authGuard");
const crypto = require("crypto");

const router = express.Router();

/* ===============================
   HELPER VALIDATION
================================ */
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

/* ===============================
   PING
================================ */
router.get("/_ping", (_req, res) => {
  res.json({ ok: true, scope: "partners-services-mysql" });
});

/* ===============================
   CREATE SERVICE
================================ */
router.post(
  "/",
  authGuard,
  [
    body("title").isString().isLength({ min: 2 }),
    body("category").isString().isLength({ min: 2 }),
    body("description").isString().isLength({ min: 2 }),
    body("fee").isFloat({ gt: 0 }),
    body("radius_km").isFloat({ gt: 0 }),
    body("latitude").isFloat(),
    body("longitude").isFloat(),
  ],
  async (req, res) => {

    if (handleValidation(req, res)) return;

    /* 🔒 PARTNER ONLY */
    if (req.user.role !== "partner") {
      return res.status(403).json({
        error: "Partner only"
      });
    }

    try {

      const partnerId = req.user.id;

      const {
        title,
        category,
        description,
        fee,
        radius_km,
        latitude,
        longitude,
      } = req.body;

      /* NORMALISER LE SLUG */

      const slug = category
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      /* TROUVER OU CREER LA CATEGORIE */

      let [catRows] = await db.execute(
        `SELECT id FROM categories WHERE slug = ? LIMIT 1`,
        [slug]
      );

      let categoryId;

      if (!catRows.length) {

        const newId = crypto.randomUUID();

        await db.execute(
          `INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)`,
          [newId, category, slug]
        );

        categoryId = newId;

      } else {

        categoryId = catRows[0].id;

      }

      /* GEO POINT */

      const point = `POINT(${longitude} ${latitude})`;

      /* INSERT SERVICE */

      const serviceId = crypto.randomUUID();

await db.execute(
`
INSERT INTO services (
  id,
  partner_id,
  title,
  category_id,
  description,
  fee,
  radius_km,
  latitude,
  longitude,
  location,
  available,
  status
)
VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?,
  ST_SRID(ST_GeomFromText(?), 4326),
  TRUE,
  'active'
)
`,
[
  serviceId,
  partnerId,
  title,
  categoryId,
  description,
  fee,
  radius_km,
  latitude,
  longitude,
  point
]
);
console.log("SERVICE CREATED:", serviceId);
return res.status(201).json({
  ok: true,
  serviceId
});

    } catch (err) {

      console.error(err);

      return res.status(500).json({ ok: false });

    }
  }
);

/* ===============================
   GET NEARBY
================================ */
router.get("/nearby", async (req, res) => {

  try {

    const { lat, lng, category } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        ok: false,
        error: "Missing lat/lng"
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    const point = `POINT(${longitude} ${latitude})`;

    const sql = `
      SELECT
        s.*,
        ST_Distance_Sphere(
          s.location,
          ST_SRID(ST_GeomFromText(?), 4326)
        ) / 1000 AS distance_km
      FROM services s
      JOIN categories c ON s.category_id = c.id
      WHERE
        s.available = TRUE
        AND s.status = 'active'
        ${category ? "AND c.slug = ?" : ""}
        AND ST_Distance_Sphere(
          s.location,
          ST_SRID(ST_GeomFromText(?), 4326)
        ) <= s.radius_km * 1000
      ORDER BY distance_km ASC
    `;

    const params = category
      ? [point, category, point]
      : [point, point];

    const [rows] = await db.execute(sql, params);

    return res.json({
      ok: true,
      items: rows
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({ ok: false });

  }

});

/* ===============================
   MY SERVICES
================================ */
router.get("/my-services", authGuard, async (req, res) => {

  if (req.user.role !== "partner") {
    return res.status(403).json({
      error: "Partner only"
    });
  }

  try {

    const partnerId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT *
      FROM services
      WHERE partner_id = ?
      ORDER BY created_at DESC
      `,
      [partnerId]
    );

    return res.json({
      ok: true,
      items: rows
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({ ok: false });

  }

});

/* ===============================
   UPDATE SERVICE
================================ */
router.put("/:id", authGuard, [param("id").isString()], async (req, res) => {

  if (handleValidation(req, res)) return;

  if (req.user.role !== "partner") {
    return res.status(403).json({
      error: "Partner only"
    });
  }

  try {

    const { id } = req.params;
    const partnerId = req.user.id;

    const { title, description, fee, radius_km } = req.body;

    await db.execute(
      `
      UPDATE services
      SET
        title = ?,
        description = ?,
        fee = ?,
        radius_km = ?,
        updated_at = NOW()
      WHERE id = ? AND partner_id = ?
      `,
      [title, description, fee, radius_km, id, partnerId]
    );

    return res.json({ ok: true });

  } catch (err) {

    console.error(err);

    return res.status(500).json({ ok: false });

  }

});

/* ===============================
   DELETE SERVICE
================================ */
router.delete("/:id", authGuard, [param("id").isString()], async (req, res) => {

  if (handleValidation(req, res)) return;

  if (req.user.role !== "partner") {
    return res.status(403).json({
      error: "Partner only"
    });
  }

  try {

    const { id } = req.params;
    const partnerId = req.user.id;

    await db.execute(
      `DELETE FROM services WHERE id = ? AND partner_id = ?`,
      [id, partnerId]
    );

    return res.json({ ok: true });

  } catch (err) {

    console.error(err);

    return res.status(500).json({ ok: false });

  }

});

/* ===============================
   SET SERVICE AVAILABILITY
================================ */
router.post("/:id/availability", authGuard, async (req,res)=>{

  console.log("📥 AVAILABILITY BODY:", req.body)
  console.log("🆔 SERVICE ID:", req.params.id)

  const serviceId = req.params.id
  const { days, startTime, endTime, instances } = req.body

  if (!Array.isArray(days) || !startTime || !endTime) {
    return res.status(400).json({
      ok:false,
      error:"Invalid payload"
    })
  }

  try{

    const partnerId = req.user.id

    /* vérifier que le service appartient au partner */

    const [rows] = await db.execute(
      `SELECT id FROM services WHERE id = ? AND partner_id = ?`,
      [serviceId, partnerId]
    )

    if(!rows.length){
      return res.status(404).json({
        ok:false,
        error:"Service not found"
      })
    }

    /* supprimer anciennes disponibilités */

    await db.execute(
      `DELETE FROM service_availability WHERE service_id = ?`,
      [serviceId]
    )

    /* insérer nouvelles disponibilités */

    for(const day of days){

      console.log("➡️ inserting day:", day)

      await db.execute(`
        INSERT INTO service_availability
        (service_id, weekday, start_time, end_time, instances)
        VALUES (?,?,?,?,?)
      `,[serviceId,day,startTime,endTime,instances || 1])

    }

    console.log("✅ AVAILABILITY SAVED")

    res.json({ok:true})

  }catch(err){

    console.error("❌ AVAILABILITY ERROR:", err)

    res.status(500).json({ok:false})

  }

})

module.exports = router;