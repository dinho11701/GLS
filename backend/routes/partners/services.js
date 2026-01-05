// backend/routes/partners/services.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { db, admin } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();

/* ------------------------- helpers ------------------------- */
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      ok: false,
      error: 'ValidationError',
      details: errors.array().map(e => ({ field: e.path, msg: e.msg })),
    });
    return true;
  }
  return false;
}

function buildSearchable({ Service, Categorie, Description, Activity_Secteur }) {
  return [Service, Categorie, Activity_Secteur, Description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/* --------------------------- ping -------------------------- */
// Monté sous /api/v1/partners -> /api/v1/partners/services/_ping
router.get('/services/_ping', (_req, res) => {
  res.json({ ok: true, scope: 'partners-services' });
});

/* ----------------------- CREATE (POST) ---------------------- */
/**
 * POST /api/v1/partners/services
 * Header optionnel: X-Idempotency-Key
 * Body:
 *  {
 *    Service, Categorie, Description, Activity_Secteur?,
 *    Fee, Pricing:{currency?},
 *    Pictures?:[{uri}],
 *    Availability?:{days:number[], startTime:"HH:MM", endTime:"HH:MM"}
 *  }
 */
router.post(
  '/services',
  authGuard, // → remplit req.user / req.user.claims
  [
    body('Service').isString().trim().isLength({ min: 2 }).withMessage('Service requis (≥2).'),
    body('Categorie').isString().trim().isLength({ min: 2 }).withMessage('Categorie requise (≥2).'),
    body('Description').isString().trim().isLength({ min: 1 }).withMessage('Description requise.'),
    body('Fee').toFloat().isFloat({ gt: 0 }).withMessage('Fee doit être > 0.'),
    body('Pricing').optional().isObject(),
    body('Pricing.currency')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 3, max: 3 })
      .withMessage('currency doit être un code ISO 3 lettres.'),

    body('Pictures').optional().isArray({ max: 10 }),
    body('Pictures.*.uri').optional().isString().trim().isLength({ min: 1 }),

    body('Availability').optional().isObject(),
    body('Availability.days').optional().isArray(),
    body('Availability.days.*')
      .optional()
      .isInt({ min: 1, max: 7 })
      .withMessage('days doit contenir des entiers 1..7 (Lun..Dim).'),
    body('Availability.startTime')
      .optional()
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage('startTime format HH:MM attendu.'),
    body('Availability.endTime')
      .optional()
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage('endTime format HH:MM attendu.'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const uid = req.user?.uid;
      const claims = req.user?.claims || {};

      if (!uid) {
        return res.status(401).json({ ok: false, error: 'missing_uid' });
      }

      /* 🔒 PARTNER ONLY
         1) On regarde les claims
         2) Si pas clair, on vérifie:
            - s'il existe un doc partners/{uid} actif
            - OU un doc customers/{uid} avec role/type partner/host
      */

      let isPartner =
        !!claims.isPartner ||
        claims.role === 'partner' ||
        claims.role === 'host';

      let partnerDoc = null;
      let customerDoc = null;

      if (!isPartner) {
        try {
          // 1) collection "partners"
          const partnerSnap = await db.collection('partners').doc(uid).get();
          if (partnerSnap.exists) {
            partnerDoc = partnerSnap.data() || {};
            const status = partnerDoc.status || 'active';
            if (status !== 'disabled' && status !== 'blocked') {
              isPartner = true;
            }
          }

          // 2) collection "customers" (cas upgrade-to-partner)
          if (!isPartner) {
            const customerSnap = await db.collection('customers').doc(uid).get();
            if (customerSnap.exists) {
              customerDoc = customerSnap.data() || {};
              const role = (customerDoc.role || customerDoc.type || '').toString().toLowerCase();
              if (role === 'partner' || role === 'host') {
                isPartner = true;
              }
            }
          }
        } catch (e) {
          console.warn(
            '[POST /partners/services] partner lookup error for uid=',
            uid,
            e.message || e
          );
        }
      }

      if (!isPartner) {
        console.warn(
          '[POST /partners/services] Forbidden for uid=',
          uid,
          'claims=',
          claims,
          'partnerDoc=',
          partnerDoc,
          'customerDoc=',
          customerDoc
        );
        return res.status(403).json({
          ok: false,
          error: 'partner_only',
          message: 'Accès réservé aux partenaires.',
        });
      }

      // Idempotence (optionnelle)
      const idemHeader = String(req.header('X-Idempotency-Key') || '').trim();
      const idem = idemHeader || null;
      if (idem) {
        const idemSnap = await db
          .collection('services')
          .where('ownerUid', '==', uid)
          .where('idempotencyKey', '==', idem)
          .limit(1)
          .get();
        if (!idemSnap.empty) {
          const d = idemSnap.docs[0];
          return res.status(200).json({
            ok: true,
            item: { id: d.id, ...d.data() },
            idempotent: true,
          });
        }
      }

      const {
        Service,
        Categorie,
        Description,
        Activity_Secteur = Categorie,
        Fee,
        Pricing = {},
        Pictures = [],
        Availability = null,
      } = req.body;

      const currency = String((Pricing?.currency || 'CAD')).toUpperCase().slice(0, 3);
      const safePictures = Array.isArray(Pictures)
        ? Pictures.slice(0, 10)
            .map(p => ({ uri: String(p?.uri || '') }))
            .filter(p => p.uri)
        : [];

      const now = admin.firestore.FieldValue.serverTimestamp();
      const docRef = db.collection('services').doc();

      const payload = {
        ownerUid: uid,
        Service: String(Service).trim(),
        Categorie: String(Categorie).trim(),
        Description: String(Description).trim(),
        Activity_Secteur: String(Activity_Secteur || '').trim() || null,
        Fee: Number(Fee),
        Pricing: { currency },
        Pictures: safePictures,
        Availability: Availability || null,
        searchable: buildSearchable({ Service, Categorie, Description, Activity_Secteur }),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        idempotencyKey: idem,
      };

      await docRef.set(payload);
      const snap = await docRef.get();

      res.set('Location', `/api/v1/partners/services/${docRef.id}`);

      return res.status(201).json({ ok: true, item: { id: snap.id, ...snap.data() } });
    } catch (e) {
      console.error('[POST /partners/services] ERROR', e);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  }
);

/* --------------- LIST INSTANCES ----------------------------- */
router.get(
  '/services/:id/instances',
  authGuard,
  [param('id').isString().isLength({ min: 4 })],
  async (req, res) => {
    try {
      if (handleValidation(req, res)) return;

      const { id } = req.params;
      const { status, order = 'asc' } = req.query;

      const svcRef = db.collection('services').doc(id);
      const svcSnap = await svcRef.get();
      if (!svcSnap.exists) {
        return res.status(404).json({ ok: true, error: 'Service introuvable' });
      }

      let items;
      if (status) {
        const snap = await svcRef
          .collection('instances')
          .where('status', '==', String(status))
          .get();

        items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
          const aTs =
            a.createdAt?.toMillis?.() ?? (a.createdAt?._seconds ?? 0) * 1000;
          const bTs =
            b.createdAt?.toMillis?.() ?? (b.createdAt?._seconds ?? 0) * 1000;
          return order === 'desc' ? bTs - aTs : aTs - bTs;
        });
      } else {
        const snap = await svcRef
          .collection('instances')
          .orderBy('createdAt', order === 'desc' ? 'desc' : 'asc')
          .get();

        items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      return res.json({ ok: true, items });
    } catch (e) {
      console.error('[GET /services/:id/instances] ERROR', e);
      return res.status(500).json({ ok: false, error: 'Erreur serveur.' });
    }
  }
);



/* -------------------------------------------------------------
   GET /partners/my-services (corrigé)
------------------------------------------------------------- */
router.get('/my-services', authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ ok: false, error: "missing_uid" });
    }

    const role = (req.user?.claims?.role || "").toLowerCase();
    const isPartner = req.user?.claims?.isPartner || role === "partner" || role === "host";

    if (!isPartner) {
      return res.status(403).json({ ok: false, error: "partner_only" });
    }

    const snap = await db
      .collection("services")
      .where("ownerUid", "==", uid)
      .get();

    const daysMap = {1:"Lun",2:"Mar",3:"Mer",4:"Jeu",5:"Ven",6:"Sam",7:"Dim"};

    let services = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      /* 🎯 instances — 3 niveaux */
      let instancesCount = 0;

      if (typeof data.instances === "number") {
        instancesCount = data.instances;

      } else if (typeof data?.Availability?.instances === "number") {
        instancesCount = data.Availability.instances;

      } else {
        const instSnap = await db
          .collection("services")
          .doc(doc.id)
          .collection("instances")
          .get();

        instancesCount = instSnap.size;
      }

      /* disponibilité */
      const availabilityDays =
        data?.Availability?.days?.map(d => daysMap[d] || d) || [];

      const availabilityHours =
        data?.Availability?.startTime && data?.Availability?.endTime
          ? `${data.Availability.startTime} - ${data.Availability.endTime}`
          : null;

      services.push({
        id: doc.id,
        ...data,
        instancesCount,
        availabilityDays,
        availabilityHours,
      });
    }

    services.sort((a, b) => {
      const aTs = a.createdAt?._seconds || 0;
      const bTs = b.createdAt?._seconds || 0;
      return bTs - aTs;
    });

    return res.json({ ok: true, items: services });

  } catch (err) {
    console.error("[GET /partners/my-services] ERROR", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});


/* -------------------------------------------------------------
   GET /partners/services/:id — détail d’un service (corrigé)
------------------------------------------------------------- */
router.get("/services/:id", authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const id = req.params.id;

    if (!uid) return res.status(401).json({ ok: false, error: "missing_uid" });

    const snap = await db.collection("services").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });

    const data = snap.data();
    if (data.ownerUid !== uid) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    /* 🎯 instances — 3 niveaux */
    let instancesCount = 0;

    if (typeof data.instances === "number") {
      instancesCount = data.instances;

    } else if (typeof data?.Availability?.instances === "number") {
      instancesCount = data.Availability.instances;

    } else {
      const instSnap = await db
        .collection("services")
        .doc(id)
        .collection("instances")
        .get();

      instancesCount = instSnap.size;
    }

    /* disponibilité */
    const daysMap = {1:"Lun",2:"Mar",3:"Mer",4:"Jeu",5:"Ven",6:"Sam",7:"Dim"};
    const availabilityDays =
      data?.Availability?.days?.map(d => daysMap[d] || d) || [];

    const availabilityHours =
      data?.Availability?.startTime && data?.Availability?.endTime
        ? `${data.Availability.startTime} - ${data.Availability.endTime}`
        : null;

    return res.json({
      ok: true,
      item: {
        id: snap.id,
        ...data,
        instancesCount,
        availabilityDays,
        availabilityHours,
      }
    });

  } catch (err) {
    console.error("[GET /partners/services/:id] ERROR", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});


/* -------------------------------------------------------------
   DELETE /partners/services/:id — supprimer un service
------------------------------------------------------------- */
router.delete("/services/:id", authGuard, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const id = req.params.id;

    if (!uid) {
      return res.status(401).json({ ok: false, error: "missing_uid" });
    }

    const ref = db.collection("services").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const data = snap.data();

    // Vérifier que le service appartient au host
    if (data.ownerUid !== uid) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    /* -------------------------------------------
       🔥 Supprimer les sous-docs (instances)
    ------------------------------------------- */
    const instSnap = await ref.collection("instances").get();
    const batch = db.batch();

    instSnap.forEach(doc => batch.delete(doc.ref));

    // Supprimer le service lui-même
    batch.delete(ref);

    await batch.commit();

    return res.json({ ok: true, deleted: id });

  } catch (err) {
    console.error("[DELETE /partners/services/:id] ERROR", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});




module.exports = router;
