// backend/routes/partners/profile.js

const express = require("express");
const { body, validationResult } = require("express-validator");
const authGuard = require("../../middleware/authGuard");
const pool = require("../../config/mysql");

const router = express.Router();

/* ---------------------------------------------------- */
/* GET PROFILE */
/* ---------------------------------------------------- */

router.get("/profile", authGuard, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT * FROM partners WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        error: "PROFILE_NOT_FOUND",
        message: "Aucun profil partenaire trouvé.",
      });
    }

    return res.json({
      ok: true,
      item: rows[0],
    });

  } catch (err) {
    console.error("GET partners/profile error:", err);

    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "Erreur serveur.",
    });
  }
});

/* ---------------------------------------------------- */
/* UPDATE PROFILE */
/* ---------------------------------------------------- */

router.put(
  "/profile",
  authGuard,
  [
    body("nom").isString().trim().isLength({ min: 2 }),
    body("secteur").optional().isString(),
    body("numero_phone").optional().isString(),
    body("adresse").optional().isString(),
    body("email").optional().isEmail(),
    body("logo").optional().isString(),
    body("nom_owner").optional().isString(),
    body("user").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({
        ok: false,
        error: "VALIDATION_ERROR",
        details: errors.array(),
      });
    }

    try {
      const userId = req.user.id;

      const {
        nom,
        secteur,
        numero_phone,
        adresse,
        email,
        logo,
        nom_owner,
        user,
      } = req.body;

      /* ------------------------------------------------ */
      /* UPDATE QUERY                                     */
      /* ------------------------------------------------ */

      await pool.query(
        `
        UPDATE partners
        SET
          nom = ?,
          secteur = ?,
          numero_phone = ?,
          adresse = ?,
          email = ?,
          logo = ?,
          nom_owner = ?,
          user = ?
        WHERE id = ?
        `,
        [
          nom,
          secteur || null,
          numero_phone || null,
          adresse || null,
          email || null,
          logo || null,
          nom_owner || null,
          user || null,
          userId,
        ]
      );

      /* ------------------------------------------------ */
      /* RETURN UPDATED                                  */
      /* ------------------------------------------------ */

      const [rows] = await pool.query(
        `SELECT * FROM partners WHERE id = ? LIMIT 1`,
        [userId]
      );

      return res.json({
        ok: true,
        item: rows[0],
      });

    } catch (err) {
      console.error("PUT partners/profile error:", err);

      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Erreur serveur lors de la mise à jour.",
      });
    }
  }
);

module.exports = router;