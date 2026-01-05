const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { db } = require("../../config/firebase");
const authGuard = require("../../middleware/authGuard");

const router = express.Router();

/* ---------------------------------------------------------
   🔥 DÉSACTIVATION COMPLÈTE DU CACHE (le FIX principal)
--------------------------------------------------------- */
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

/* ---------- Utils ---------- */
const toEpoch = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === "function") return v.toDate().getTime();
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

/** 🔍 Récupère un identifiant partenaire (legacy + compat) */
async function getPartnerSlugOrCode(user) {
  if (!user) return null;

  const fromClaims =
    user?.claims?.partnerId ||
    user?.claims?.partnerSlug ||
    user?.claims?.handle;

  if (fromClaims) return fromClaims;

  try {
    const byUid = await db.collection("partners").doc(user.uid).get();
    if (byUid?.exists) {
      const p = byUid.data() || {};
      return p.slug || p.partnerId || p.code || p.handle || null;
    }
  } catch (_) {}

  try {
    const q1 = await db
      .collection("partners")
      .where("uid", "==", user.uid)
      .limit(1)
      .get();

    if (!q1.empty) {
      const p = q1.docs[0].data() || {};
      return p.slug || p.partnerId || p.code || p.handle || null;
    }
  } catch (_) {}

  try {
    if (user.email) {
      const q2 = await db
        .collection("partners")
        .where("email", "==", user.email)
        .limit(1)
        .get();

      if (!q2.empty) {
        const p = q2.docs[0].data() || {};
        return p.slug || p.partnerId || p.code || p.handle || null;
      }
    }
  } catch (_) {}

  return null;
}

/* ---------------------------------------------------------
   GET — Lister les réservations du partenaire (optimisé)
--------------------------------------------------------- */
router.get(
  "/",
  authGuard,
  [
    query("status")
      .optional()
      .isIn(["pending", "accepted", "refused", "confirmed", "cancelled"]),
    query("includeCancelled").optional().isIn(["0", "1"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { uid } = req.user;

      /* 1️⃣ Récupération */
      const snap = await db
        .collection("reservations")
        .where("partnerUid", "==", uid)
        .get();

      let reservations = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      /* 2️⃣ Cache des services */
      const serviceCache = {};

      async function getServiceTitle(serviceId) {
        if (!serviceId) return "Service";

        if (serviceCache[serviceId]) return serviceCache[serviceId];

        const doc = await db.collection("services").doc(serviceId).get();

        let title = "Service";
        if (doc.exists) {
          const s = doc.data();
          title =
            s.title ||
            s.name ||
            s.Service ||
            s.Categorie ||
            "Service";
        }

        serviceCache[serviceId] = title;
        return title;
      }

      /* 3️⃣ Injection des titres des services */
      reservations = await Promise.all(
        reservations.map(async (r) => ({
          ...r,
          serviceTitle: await getServiceTitle(r.serviceId),
        }))
      );

      /* 🚨 4️⃣ Fallback automatique → status = pending */
      reservations = reservations.map((r) => ({
        ...r,
        status:
          ["pending", "accepted", "refused", "confirmed", "cancelled"].includes(
            r.status
          )
            ? r.status
            : "pending", // ← DEFAULT FIX
      }));

      /* 5️⃣ Filtrage */
      const { status, includeCancelled } = req.query;

      if (status) {
        reservations = reservations.filter((r) => r.status === status);
      } else {
        if (includeCancelled !== "1") {
          reservations = reservations.filter((r) => r.status !== "cancelled");
        }
      }

      /* 6️⃣ Tri */
      const toEpoch = (v) =>
        v?.toDate ? v.toDate().getTime() : new Date(v).getTime();

      reservations.sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));

      /* 7️⃣ Réponse */
      res.json({ reservations });
    } catch (err) {
      console.error("[PARTNERS][RESERVATIONS][LIST][ERROR]", err);
      res.status(500).json({
        error: "Impossible de récupérer les réservations",
      });
    }
  }
);

/* ---------------------------------------------------------
   PATCH — Modifier statut reservation
--------------------------------------------------------- */
router.patch(
  "/:id/status",
  authGuard,
  [
    param("id").notEmpty(),
    body("status")
      .isIn(["accepted", "refused", "confirmed", "cancelled"])
      .withMessage("Status invalide"),
  ],
  async (req, res) => {
    console.log("\n------------------------------------------------");
    console.log(`🔄 PATCH /reservations/${req.params.id}/status`);
    console.log("🔑 Requested status:", req.body.status);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation error:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { uid } = req.user;
      const wanted = req.body.status;

      const ref = db.collection("reservations").doc(id);
      const doc = await ref.get();

      if (!doc.exists)
        return res.status(404).json({ error: "Réservation introuvable" });

      const data = doc.data();

      let authorized = data.partnerUid === uid;
      if (!authorized) {
        const legacyKey = await getPartnerSlugOrCode(req.user);
        authorized =
          legacyKey &&
          (data.partnerId === legacyKey || data.partnerSlug === legacyKey);
      }

      if (!authorized)
        return res.status(403).json({ error: "Accès interdit" });

      const patch = {
        status: wanted,
        updatedAt: new Date().toISOString(),
      };

      if (wanted === "cancelled") {
        patch.cancelledAt = new Date();
        patch.cancelledBy = uid;
      }

      await ref.update(patch);

      res.json({ success: true, id, status: wanted });
    } catch (err) {
      console.error("[PATCH][STATUS][ERROR]", err);
      res.status(500).json({ error: "Impossible de mettre à jour le statut" });
    }
  }
);

/* ---------------------------------------------------------
   PATCH — Modifier certains champs
--------------------------------------------------------- */
router.patch(
  "/:id",
  authGuard,
  [
    param("id").notEmpty(),
    body("startTime").custom((_, { req }) => {
      if ("startTime" in req.body)
        throw new Error("startTime interdit pour le moment");
      return true;
    }),
    body("endTime").custom((_, { req }) => {
      if ("endTime" in req.body)
        throw new Error("endTime interdit pour le moment");
      return true;
    }),
    body("note").optional().isString().trim(),
    body("price").optional().isFloat().toFloat(),
    body("durationMin").optional().isInt({ min: 1 }).toInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const { uid } = req.user;
      const input = req.body;

      const ref = db.collection("reservations").doc(id);
      const doc = await ref.get();

      if (!doc.exists)
        return res.status(404).json({ error: "Réservation introuvable" });

      const data = doc.data();

      let authorized = data.partnerUid === uid;
      if (!authorized) {
        const legacyKey = await getPartnerSlugOrCode(req.user);
        authorized =
          legacyKey &&
          (data.partnerId === legacyKey || data.partnerSlug === legacyKey);
      }

      if (!authorized) return res.status(403).json({ error: "Accès interdit" });

      const updates = {};

      if ("note" in input) updates.note = input.note;
      if ("price" in input) updates.price = input.price;
      if ("durationMin" in input) updates.durationMin = input.durationMin;

      await ref.update({ ...updates, updatedAt: new Date().toISOString() });

      res.json({ success: true, id, updates });
    } catch (err) {
      console.error("[PARTNERS][RESERVATIONS][UPDATE][ERROR]", err);
      res.status(500).json({ error: "Impossible de modifier la réservation" });
    }
  }
);

module.exports = router;
