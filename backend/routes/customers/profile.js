const express = require("express");
const { body, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const dbPool = require("../../config/mysql");

const router = express.Router();

/* ============================================================
   HELPER VALIDATION
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
   GET /customers/profile
============================================================ */
router.get("/", authGuard, async (req, res) => {
  try {
    const customerId = req.user.id;

    const [rows] = await dbPool.query(
      `
      SELECT 
        id,
        email,
        user,
        nom,
        prenom,
        phone,
        adresse,
        wallet,
        created_at
      FROM customers
      WHERE id = ?
      LIMIT 1
      `,
      [customerId]
    );

    if (!rows.length) {
      return res.json({
        ok: false,
        message: "Profil introuvable.",
      });
    }

    return res.json({
      ok: true,
      user: rows[0],
    });
  } catch (err) {
    console.error("[GET PROFILE ERROR]", err);
    return res.status(500).json({
      ok: false,
      message: "Erreur serveur.",
    });
  }
});

/* ============================================================
   PUT /customers/profile
============================================================ */
router.put(
  "/",
  authGuard,
  [
    body("nom").optional().isString().isLength({ max: 100 }),
    body("prenom").optional().isString().isLength({ max: 100 }),
    body("email").optional().isEmail(),
    body("user").optional().isString().isLength({ min: 3, max: 50 }),
    body("phone").optional().isString().isLength({ max: 30 }),
    body("adresse").optional().isString().isLength({ max: 255 }),
    body("wallet").optional().isString().isLength({ max: 255 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const connection = await dbPool.getConnection();

    try {
      await connection.beginTransaction();

      const customerId = req.user.id;

      const {
        nom,
        prenom,
        email,
        user,
        phone,
        adresse,
        wallet,
      } = req.body;

      /* 🔹 Vérification email unique */
      if (email) {
        const [emailRows] = await connection.query(
          `
          SELECT id FROM customers
          WHERE email = ? AND id != ?
          `,
          [email, customerId]
        );

        if (emailRows.length) {
          await connection.rollback();
          return res.status(400).json({
            ok: false,
            message: "Email déjà utilisé.",
          });
        }
      }

      /* 🔹 Update dynamique */
      await connection.query(
        `
        UPDATE customers
        SET
          nom = COALESCE(?, nom),
          prenom = COALESCE(?, prenom),
          email = COALESCE(?, email),
          user = COALESCE(?, user),
          phone = COALESCE(?, phone),
          adresse = COALESCE(?, adresse),
          wallet = COALESCE(?, wallet)
        WHERE id = ?
        `,
        [
          nom || null,
          prenom || null,
          email || null,
          user || null,
          phone || null,
          adresse || null,
          wallet || null,
          customerId,
        ]
      );

      await connection.commit();

      return res.json({
        ok: true,
        message: "Profil mis à jour.",
      });
    } catch (err) {
      await connection.rollback();
      console.error("[UPDATE PROFILE ERROR]", err);
      return res.status(500).json({
        ok: false,
        message: "Erreur serveur.",
      });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;