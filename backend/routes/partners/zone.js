const express = require("express");
const pool = require("../../config/mysql");

const router = express.Router();

/**
 * GET zone
 */
router.get("/", async (req, res) => {
  try {
    console.log("🔥 GET /partners/zone");

    if (!req.user || !req.user.id) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const partnerId = req.user.id;
    console.log("👉 Partner ID:", partnerId);

    const [rows] = await pool.query(
      "SELECT * FROM partner_zones WHERE partner_id = ?",
      [partnerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "zone_not_found" });
    }

    return res.json({ ok: true, zone: rows[0] });

  } catch (err) {
    console.error("GET zone error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST zone
 */
router.post("/", async (req, res) => {
  try {
    console.log("🔥 POST /partners/zone");
    console.log("👉 BODY:", req.body);
    console.log("REQ.USER:", req.user);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const partnerId = req.user.id;
    const { center, radiusKm, available } = req.body;

    if (!center?.latitude || !center?.longitude) {
      return res.status(400).json({ ok: false, error: "invalid_center" });
    }

    console.log("👉 Saving zone for partner:", partnerId);

    await pool.query(
      `
      INSERT INTO partner_zones 
        (partner_id, latitude, longitude, radius_km, available)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        radius_km = VALUES(radius_km),
        available = VALUES(available)
      `,
      [
        partnerId,
        center.latitude,
        center.longitude,
        radiusKm || 5,
        available ?? true,
      ]
    );

// 🔥 GET REAL PARTNER UUID
const [partnerRows] = await pool.query(
  "SELECT partenaire_id FROM partners WHERE email = ?",
  [req.user.email]
);

if (partnerRows.length === 0) {
  throw new Error("partner_not_found");
}

const partnerUUID = partnerRows[0].partenaire_id;

// 🔥 SYNC SERVICES LOCATION
const point = `POINT(${center.longitude} ${center.latitude})`;

await pool.query(
  `
  UPDATE services
  SET
    latitude = ?,
    longitude = ?,
    location = ST_SRID(ST_GeomFromText(?), 4326),
    updated_at = NOW()
  WHERE partner_id = ?
  `,
  [
    center.latitude,
    center.longitude,
    point,
    partnerUUID
  ]
);

console.log("🔥 Services location synced");

    console.log("✅ Zone saved");

    return res.json({ ok: true });

  } catch (err) {
    console.error("POST zone error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;