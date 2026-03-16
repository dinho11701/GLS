const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../../config/mysql");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

/* ---------- Helpers ---------- */

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "ValidationError",
      details: errors.array().map((e) => ({ field: e.path, msg: e.msg })),
    });
    return true;
  }
  return false;
}

/* =====================================================
   SIGNUP
===================================================== */

router.post(
  "/signup",
  [
    body("mail").isEmail(),
    body("password").isLength({ min: 6 }),
    body("nom").isLength({ min: 2 }),
    body("prenom").isLength({ min: 2 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { mail, password, nom, prenom, user, phone, adresse, wallet } =
      req.body;

    try {
      const email = mail.toLowerCase();

      // Vérifie email unique
      const [existing] = await pool.query(
        "SELECT id FROM customers WHERE email = ?",
        [email]
      );

      if (existing.length > 0) {
        return res.status(409).json({ error: "Email déjà utilisé." });
      }

      // Hash password
      const hash = await bcrypt.hash(password, 10);

      const [result] = await pool.query(
        `INSERT INTO customers 
        (email, password_hash, user, nom, prenom, phone, adresse, wallet)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          email,
          hash,
          user || null,
          nom,
          prenom,
          phone || null,
          adresse || null,
          wallet || null,
        ]
      );

      const id = result.insertId;

      return res.status(201).json({
        ok: true,
        user: {
          id,
          role: "customer",
          email,
          nom,
          prenom,
        },
      });
    } catch (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ error: "Erreur serveur." });
    }
  }
);

/* =====================================================
   LOGIN
===================================================== */

router.post(
  "/login",
  [
    body("mail").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { mail, password } = req.body;

    try {
      const email = mail.toLowerCase();

      const [rows] = await pool.query(
        "SELECT * FROM customers WHERE email = ?",
        [email]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }

      const user = rows[0];

      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }

      // JWT
      const token = jwt.sign(
        {
          id: user.id,
          role: "customer",
          email: user.email,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        ok: true,
        token,
        user: {
          id: user.id,
          role: "customer",
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Erreur serveur." });
    }
  }
);

module.exports = router;
