const express = require("express");
const router = express.Router();
const { db } = require("../../config/firebase");
const authGuard = require("../../middleware/authGuard");

/* ============================================================
   GET /customers/profile — Récupérer le profil
============================================================ */
router.get("/", authGuard, async (req, res) => {
  try {
    const uid = req.user.uid;

    const snap = await db.collection("customers").doc(uid).get();

    if (!snap.exists)
      return res.json({ ok: false, message: "Profil introuvable." });

    return res.json({ ok: true, user: snap.data() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Erreur serveur." });
  }
});

/* ============================================================
   PUT /customers/profile — Modifier le profil
============================================================ */
router.put("/", authGuard, async (req, res) => {
  try {
    const uid = req.user.uid;

    const { nom, prenom, email, user } = req.body;

    await db.collection("customers").doc(uid).update({
      nom,
      prenom,
      email,
      user,
      userLower: user?.toLowerCase(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({ ok: true, message: "Profil mis à jour." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Erreur serveur." });
  }
});

module.exports = router;
