// backend/routes/customers/upgradeToPartner.js

const express = require("express");
const authGuard = require("../../middleware/authGuard");
const pool = require("../../config/mysql");

const router = express.Router();

router.post("/upgrade-to-partner", authGuard, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const customerId = req.user?.id;
    const email = req.user?.email || null;

    if (!customerId) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    await connection.beginTransaction();

    /* ---------------------------------------------------------
       1️⃣ GET CUSTOMER
    --------------------------------------------------------- */
    const [customerRows] = await connection.query(
      `SELECT * FROM customers WHERE id = ?`,
      [customerId]
    );

    if (!customerRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Client introuvable." });
    }

    const customer = customerRows[0];

    /* ---------------------------------------------------------
       2️⃣ CHECK SI DEJA PARTNER
    --------------------------------------------------------- */
    const [partnerRows] = await connection.query(
      `SELECT * FROM partners WHERE email = ? LIMIT 1`,
      [customer.email]
    );

    let partnerId = null;
    let alreadyPartner = false;

    if (partnerRows.length) {
      alreadyPartner = true;
      partnerId = partnerRows[0].id;
    } else {
      /* ---------------------------------------------------------
         3️⃣ CREATE PARTNER
      --------------------------------------------------------- */
      const displayName =
        customer.user ||
        customer.nom ||
        "Nouveau partenaire";

      const [insertPartner] = await connection.query(
        `
        INSERT INTO partners
        (
          partenaire_id,
          nom,
          secteur,
          numero_phone,
          adresse,
          email,
          password_hash,
          nom_owner,
          user
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          `P-${customerId}`,           // partenaire_id
          displayName,                // nom
          "Non défini",               // secteur
          customer.phone || null,
          customer.adresse || null,
          customer.email,
          customer.password_hash,     // ⚠️ réutilisé
          customer.nom || null,
          customer.user || null,
        ]
      );

      partnerId = insertPartner.insertId;
    }

    /* ---------------------------------------------------------
       4️⃣ COMMIT
    --------------------------------------------------------- */
    await connection.commit();

    return res.status(alreadyPartner ? 409 : 200).json({
      ok: true,
      customerId,
      partnerId,
      message: alreadyPartner
        ? "Utilisateur déjà partenaire."
        : "Utilisateur promu au rôle partenaire.",
    });

  } catch (e) {
    await connection.rollback();
    console.error("[UPGRADE_TO_PARTNER][ERROR]", e);

    return res.status(500).json({
      error: "Erreur lors de la mise à niveau.",
    });
  } finally {
    connection.release();
  }
});

module.exports = router;