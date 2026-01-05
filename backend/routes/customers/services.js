// routes/customers/services.js
const express = require('express');
const { query, validationResult } = require('express-validator');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');
const { checkAvailability } = require("../../utils/checkAvailability");

const router = express.Router();

/* --------------------------------- Utils ---------------------------------- */
function jitterAround(base, meters = 250) {
  if (!base || typeof base.lat !== 'number' || typeof base.lng !== 'number') return null;
  const dx = (Math.random() - 0.5) * 2;
  const dy = (Math.random() - 0.5) * 2;
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.cos((base.lat * Math.PI) / 180));
  return { lat: base.lat + dy * dLat, lng: base.lng + dx * dLng };
}

/* ============================================================================
   GET /customers/services/check-availability
============================================================================ */
router.get(
  '/check-availability',
  authGuard,
  [
    query('serviceId').notEmpty(),
    query('date').notEmpty(),
    query('startTime').notEmpty(),
    query('endTime').notEmpty(),
  ],
  async (req, res) => {
    try {
      const { serviceId, date, startTime, endTime } = req.query;

      const svcDoc = await db.collection("services").doc(serviceId).get();
      if (!svcDoc.exists)
        return res.json({ ok: false, reason: "Service introuvable" });

      const svc = svcDoc.data();
      const partnerUid = svc.ownerUid;

      if (!partnerUid)
        return res.json({ ok: false, reason: "Service sans partenaire" });

      // 🔥 FIX : ici, date = "2025-12-28"
      // checkAvailability doit travailler en JS-day (0= dimanche)
      const avail = await checkAvailability({
        partnerUid,
        serviceId,
        date,        // → checkAvailability doit gérer 0..6
        startTime,
        endTime,
      });

      if (!avail.ok) return res.json(avail);

      return res.json({
        ok: true,
        durationMin: avail.durationMin,
      });

    } catch (err) {
      console.error("[CHECK-AVAILABILITY ERROR]", err);
      return res.status(500).json({ ok: false, reason: "Erreur serveur" });
    }
  }
);

/* ============================================================================
   GET /customers/services — LISTE DE SERVICES
============================================================================ */
router.get(
  '/',
  authGuard,
  [
    query('date').optional().isString(),
    query('q').optional().isString().trim().isLength({ max: 100 }),
    query('category').optional().isString().trim(),
    query('secteur').optional().isString().trim(),
    query('partnerId').optional().isString().trim(),
    query('move').optional().isIn(['Move', 'Fixe']),
    query('minFee').optional().isFloat({ min: 0 }),
    query('maxFee').optional().isFloat({ min: 0 }),
    query('subscription').optional().isIn(['true', 'false']),
    query('sort').optional().isIn(['createdAt', 'Fee']),
    query('dir').optional().isIn(['asc', 'desc']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('cursor').optional().isString().trim(),
  ],
  async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const {
        q, category, secteur, partnerId, move,
        minFee, maxFee, subscription,
        sort, dir = 'desc',
        limit = 12, cursor,
        date
      } = req.query;

      const targetDate = date ? String(date) : null;

      console.log("📌 SERVICES LIST — TARGET DATE =", targetDate);

      let ref = db.collection('services');

      /* ---------------------- FILTRES ---------------------- */
      if (category) ref = ref.where('Categorie', '==', category);
      if (secteur) ref = ref.where('Activity_Secteur', '==', secteur);
      if (partnerId) ref = ref.where('partenaire_ID', '==', partnerId);
      if (move) ref = ref.where('Location_Fixe_Move', '==', move);

      if (subscription === 'true') ref = ref.where('Subscribtion', '==', true);
      if (subscription === 'false') ref = ref.where('Subscribtion', '==', false);

      let usesIneqOn = null;

      if (minFee) { ref = ref.where('Fee', '>=', Number(minFee)); usesIneqOn = 'Fee'; }
      if (maxFee) { ref = ref.where('Fee', '<=', Number(maxFee)); usesIneqOn = 'Fee'; }

      if (q && q.trim()) {
        const qLower = q.trim().toLowerCase();
        ref = ref
          .where('searchable', '>=', qLower)
          .where('searchable', '<', qLower + '\uf8ff');
        usesIneqOn = 'searchable';
      }

      if (usesIneqOn) {
        ref = ref.orderBy(usesIneqOn);
        if (sort && sort !== usesIneqOn) ref = ref.orderBy(sort, dir);
      } else if (sort) {
        ref = ref.orderBy(sort, dir);
      }

      if (cursor) {
        const docSnap = await db.collection('services').doc(cursor).get();
        if (!docSnap.exists)
          return res.status(400).json({ ok: false, message: 'Cursor invalide' });
        ref = ref.startAfter(docSnap);
      }

      const snap = await ref.limit(Number(limit)).get();
      const items = [];

      console.log(`📅 TARGET DATE = ${targetDate}`);

      /* -----------------------------------------------------------
   CALCUL DES PLACES — IGNORE CANCELLED BOOKINGS
----------------------------------------------------------- */
for (const d of snap.docs) {
  const svc = { id: d.id, ...d.data() };

  const instancesTotal =
    (svc.Availability?.instances ?? svc.places ?? 0);

  if (instancesTotal <= 0) continue;

  let instancesBooked = 0;

  if (targetDate) {
    const resSnap = await db
      .collection('reservations')
      .where('serviceId', '==', d.id)
      .get();

    const allReservations = resSnap.docs.map(doc => {
      const r = doc.data() || {};
      return {
        id: doc.id,
        status: r.status,
        calDate: r.calendar?.date,
      };
    });

    instancesBooked = allReservations.filter(r =>
      r.status !== "cancelled" && r.calDate === targetDate
    ).length;
  }

const remainingInstances = Math.max(instancesTotal - instancesBooked, 0);


  items.push({
    ...svc,
    instancesTotal,
    instancesBooked,
    remainingInstances,   // ⭐ OBLIGATOIRE
    isFull: remainingInstances === 0, // ⭐ super pratique aussi
  });
}


      const nextCursor =
        snap.size > 0 && items.length > 0
          ? items[items.length - 1].id
          : null;

      return res.json({
        ok: true,
        count: items.length,
        nextCursor,
        items
      });

    } catch (err) {
      console.error('GET /customers/services error:', err);
      return res.status(500).json({ ok: false, message: 'Erreur serveur', details: String(err) });
    }
  }
);

/* ============================================================================
   GET /customers/services/:id — DÉTAIL D’UN SERVICE
============================================================================ */
router.get(
  '/:id',
  authGuard,
  async (req, res) => {
    try {
      const id = req.params.id;

      console.log("🔥 DETAIL REQ — ID =", id);

      const doc = await db.collection('services').doc(id).get();
      if (!doc.exists)
        return res.status(404).json({ ok: false, message: 'Service introuvable' });

      const raw = doc.data() || {};

      const startTime =
        raw.startTime ||
        raw.Availability?.startTime ||
        null;

      const endTime =
        raw.endTime ||
        raw.Availability?.endTime ||
        null;

      const instances =
        raw.Availability?.instances ??
        raw.instances ??
        raw.instancesTotal ??
        raw.places ??
        1;

      const Availability = {
        startTime,
        endTime,
        instances: Number(instances)
      };

      const weekly =
        raw.weekly ||
        raw.Weekly ||
        raw.availability_weekly ||
        null;

      const Pricing = {
        currency: raw.Pricing?.currency || "CAD",
        price: raw.Fee ?? raw.price ?? null,
      };

      const partner = raw.partner || raw.partnerInfo || null;

      const payload = {
        id: doc.id,
        Service: raw.Service || raw.title || "Service",
        Description: raw.Description || raw.desc || "",
        Activity_Secteur: raw.Activity_Secteur || raw.secteur || null,
        Fee: raw.Fee ?? raw.price ?? null,
        coverUrl: raw.coverUrl || raw.cover || null,
        images: raw.images || [],
        move: raw.Location_Fixe_Move || raw.move || null,
        Availability,
        weekly,
        Pricing,
        partner,
        location: raw.location || raw.position || raw.coords || null,
        instancesTotal: Number(instances),
        legacy: {
          rawAvailability: raw.Availability || null,
          rawWeekly: raw.weekly || raw.Weekly || null,
        },
        createdAt: raw.createdAt || null,
        updatedAt: raw.updatedAt || null,
      };

      console.log("🔥 DETAIL PAYLOAD NORMALIZED →", payload);

      return res.json(payload);

    } catch (err) {
      console.error("GET /customers/services/:id ERROR", err);
      return res.status(500).json({ ok: false, message: 'Erreur serveur' });
    }
  }
);

module.exports = router;
