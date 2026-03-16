const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../../config/mysql");
const authGuard = require("../../middleware/authGuard");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

/* -----------------------
   Helpers
-----------------------*/
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("❌ VALIDATION ERROR:", errors.array());
    res.status(400).json({ ok: false, errors: errors.array() });
    return true;
  }
  return false;
}

/* =====================================================
   LOGIN PARTNER (AVEC LOGS)
===================================================== */
router.post(
  "/login",
  [
    body("mail").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    console.log("🔥 /partners/login HIT");
    console.log("👉 URL:", req.originalUrl);
    console.log("👉 BODY:", req.body);

    if (handleValidation(req, res)) return;

    const { mail, password } = req.body;

    try {
      const email = mail.toLowerCase();
      console.log("🔍 Looking for email:", email);

      const [rows] = await pool.query(
        "SELECT * FROM partners WHERE email = ?",
        [email]
      );

      console.log("📦 DB rows found:", rows.length);

      if (rows.length === 0) {
        console.log("❌ No partner found");
        return res.status(401).json({ ok: false, error: "invalid_credentials" });
      }

      const partner = rows[0];

      const match = await bcrypt.compare(password, partner.password_hash);
      console.log("🔑 Password match:", match);

      if (!match) {
        return res.status(401).json({ ok: false, error: "invalid_credentials" });
      }

      const token = jwt.sign(
        {
          id: partner.id,
          role: "partner",
          email: partner.email,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      console.log("✅ LOGIN SUCCESS for:", partner.email);

      return res.json({
        ok: true,
        token,
        user: {
          id: partner.id,
          role: "partner",
          email: partner.email,
          nom: partner.nom,
          secteur: partner.secteur,
        },
      });

    } catch (err) {
      console.error("🚨 Partner login error:", err);
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
);

module.exports = router;