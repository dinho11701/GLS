// routes/partners/availability.js
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { DateTime, Interval } = require('luxon');
const { db, admin } = require('../../config/firebase'); // doit exposer { db, admin }
const authGuard = require('../../middleware/authGuard');

const router = express.Router();

/**à
 * Modèle de document Firestore (collection: partner_availability):
 * {
 *   id: <auto>,
 *   partnerUid: string,
 *   kind: 'weekly' | 'override',
 *   tz: 'America/Toronto',
 *   // weekly
 *   day: 0..6,
 *   // override
 *   date: 'YYYY-MM-DD',
 *   // commun
 *   ranges: [{ start: 'HH:mm', end: 'HH:mm' }, ...],
 *   closed: boolean, // si true => indisponible ce jour
 *   effectiveFrom: 'YYYY-MM-DD' | null,
 *   effectiveTo:   'YYYY-MM-DD' | null,
 *   active: true,
 *   createdAt, updatedAt
 * }
 */

// --------- helpers ---------
function ensureValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
}

function timeToMinutes(t) {
  // t: 'HH:mm'
  const [H, M] = t.split(':').map(Number);
  return H * 60 + M;
}

function isValidHHmm(t) {
  return /^\d{2}:\d{2}$/.test(t) && timeToMinutes(t) >= 0 && timeToMinutes(t) < 24 * 60;
}

function validateRangesNonOverlapping(ranges) {
  const sorted = [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!isValidHHmm(r.start) || !isValidHHmm(r.end)) return false;
    if (timeToMinutes(r.end) <= timeToMinutes(r.start)) return false;
    if (i > 0) {
      const prev = sorted[i - 1];
      if (timeToMinutes(r.start) < timeToMinutes(prev.end)) return false; // chevauchement
    }
  }
  return true;
}

function normalizeRanges(ranges = []) {
  // Tri + fusion des adjacences (ex: 09:00-12:00 et 12:00-13:00 -> 09:00-13:00)
  const sorted = [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const out = [];
  for (const r of sorted) {
    if (!out.length) {
      out.push({ start: r.start, end: r.end });
      continue;
    }
    const last = out[out.length - 1];
    if (timeToMinutes(r.start) === timeToMinutes(last.end)) {
      last.end = r.end; // fusion
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }
  return out;
}

function applyWeeklyAndOverrides({ weekly, overrides, from, to, tz }) {
  // Renvoie un tableau par date: { date:'YYYY-MM-DD', closed:boolean, ranges:[{start,end}] }
  const days = [];
  let cursor = DateTime.fromISO(from, { zone: tz });
  const end = DateTime.fromISO(to, { zone: tz });
  while (cursor <= end) {
    const dStr = cursor.toISODate();
    const dow = cursor.weekday % 7; // luxon: 1=lundi..7=dimanche -> 0..6 en %7
    // weekly actives pour ce jour et dans période effective
    const wMatches = weekly.filter(w => {
      if (w.day !== ((cursor.weekday % 7))) return false;
      if (w.effectiveFrom && DateTime.fromISO(w.effectiveFrom) > cursor) return false;
      if (w.effectiveTo && DateTime.fromISO(w.effectiveTo) < cursor) return false;
      return true;
    });

    // compose ranges weekly
    let ranges = normalizeRanges(wMatches.flatMap(w => w.ranges || []));
    let closed = wMatches.length === 0 || ranges.length === 0;

    // override exact pour cette date (si plusieurs, la dernière “gagne” en fusionnant, simple priorité: on remplace)
    const oMatches = overrides.filter(o => o.date === dStr);
    if (oMatches.length) {
      const last = oMatches[oMatches.length - 1];
      closed = !!last.closed;
      ranges = closed ? [] : normalizeRanges(last.ranges || []);
    }

    days.push({ date: dStr, closed, ranges });
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

async function getAvailabilityDocs(partnerUid) {
  const snap = await db.collection('partner_availability')
    .where('partnerUid', '==', partnerUid)
    .where('active', '==', true)
    .get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    weekly: docs.filter(d => d.kind === 'weekly'),
    overrides: docs.filter(d => d.kind === 'override'),
    all: docs,
  };
}

// --------- Validators (common) ---------
const rangeValidator = body('ranges')
  .optional()
  .isArray({ min: 1 }).withMessage('ranges must be a non-empty array of {start,end}')
  .custom((ranges) => {
    if (!Array.isArray(ranges)) return false;
    if (!ranges.every(r => r && typeof r.start === 'string' && typeof r.end === 'string')) {
      throw new Error('Each range requires start,end as HH:mm');
    }
    if (!validateRangesNonOverlapping(ranges)) {
      throw new Error('ranges have invalid or overlapping intervals');
    }
    return true;
  });

const effectiveValidator = [
  body('effectiveFrom').optional().isISO8601().withMessage('effectiveFrom must be YYYY-MM-DD'),
  body('effectiveTo').optional().isISO8601().withMessage('effectiveTo must be YYYY-MM-DD'),
  body().custom((val) => {
    const { effectiveFrom, effectiveTo } = val;
    if (effectiveFrom && effectiveTo) {
      const from = DateTime.fromISO(effectiveFrom);
      const to = DateTime.fromISO(effectiveTo);
      if (to < from) throw new Error('effectiveTo must be on/after effectiveFrom');
    }
    return true;
  })
];

// --------- LIST (GET) ---------
router.get(
  '/',
  authGuard,
  async (req, res) => {
    try {
      const partnerUid = req.user?.uid || req.user?.partnerUid || req.user?.sub; // selon votre authGuard
      if (!partnerUid) return res.status(401).json({ error: 'Missing partner identity' });

      const { weekly, overrides, all } = await getAvailabilityDocs(partnerUid);
      return res.json({ weekly, overrides, all });
    } catch (err) {
      console.error('[AVAILABILITY][LIST][ERROR]', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

// --------- CREATE (POST) ---------
router.post(
  '/',
  authGuard,
  [
    body('kind').isIn(['weekly', 'override']).withMessage('kind must be weekly|override'),
    body('tz').isString().notEmpty().withMessage('tz is required (e.g., America/Toronto)'),
    body('closed').optional().isBoolean(),
    body('day').if(body('kind').equals('weekly')).isInt({ min: 0, max: 6 }).withMessage('day must be 0..6'),
    body('date').if(body('kind').equals('override')).isISO8601().withMessage('date must be YYYY-MM-DD'),
    rangeValidator,
    ...effectiveValidator,
  ],
  async (req, res) => {
    const invalid = ensureValid(req, res);
    if (invalid) return invalid;

    try {
      const partnerUid = req.user?.uid || req.user?.partnerUid || req.user?.sub;
      if (!partnerUid) return res.status(401).json({ error: 'Missing partner identity' });

      const payload = req.body;
      const doc = {
        partnerUid,
        kind: payload.kind,
        tz: payload.tz,
        day: payload.kind === 'weekly' ? payload.day : null,
        date: payload.kind === 'override' ? DateTime.fromISO(payload.date).toISODate() : null,
        ranges: payload.closed ? [] : normalizeRanges(payload.ranges || []),
        closed: !!payload.closed,
        effectiveFrom: payload.effectiveFrom ? DateTime.fromISO(payload.effectiveFrom).toISODate() : null,
        effectiveTo: payload.effectiveTo ? DateTime.fromISO(payload.effectiveTo).toISODate() : null,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const ref = await db.collection('partner_availability').add(doc);
      const saved = await ref.get();
      return res.status(201).json({ id: ref.id, ...saved.data() });
    } catch (err) {
      console.error('[AVAILABILITY][CREATE][ERROR]', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

// --------- READ ONE (GET /:id) ---------
router.get(
  '/:id',
  authGuard,
  [param('id').isString().notEmpty()],
  async (req, res) => {
    const invalid = ensureValid(req, res);
    if (invalid) return invalid;

    try {
      const partnerUid = req.user?.uid || req.user?.partnerUid || req.user?.sub;
      const doc = await db.collection('partner_availability').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Not found' });
      const data = doc.data();
      if (data.partnerUid !== partnerUid) return res.status(403).json({ error: 'Forbidden' });
      return res.json({ id: doc.id, ...data });
    } catch (err) {
      console.error('[AVAILABILITY][READ][ERROR]', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

// --------- UPDATE (PATCH /:id) ---------
router.patch(
  '/:id',
  authGuard,
  [
    param('id').isString().notEmpty(),
    body('tz').optional().isString().notEmpty(),
    body('closed').optional().isBoolean(),
    body('day').optional().isInt({ min: 0, max: 6 }),
    body('date').optional().isISO8601(),
    rangeValidator,
    ...effectiveValidator,
  ],
  async (req, res) => {
    const invalid = ensureValid(req, res);
    if (invalid) return invalid;

    try {
      const partnerUid = req.user?.uid || req.user?.partnerUid || req.user?.sub;
      const ref = db.collection('partner_availability').doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Not found' });
      const current = snap.data();
      if (current.partnerUid !== partnerUid) return res.status(403).json({ error: 'Forbidden' });

      const updates = { ...req.body };
      if (typeof updates.ranges !== 'undefined') {
        updates.ranges = updates.closed ? [] : normalizeRanges(updates.ranges || []);
      }
      if (updates.date) updates.date = DateTime.fromISO(updates.date).toISODate();
      if (updates.effectiveFrom) updates.effectiveFrom = DateTime.fromISO(updates.effectiveFrom).toISODate();
      if (updates.effectiveTo) updates.effectiveTo = DateTime.fromISO(updates.effectiveTo).toISODate();
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await ref.update(updates);
      const fresh = await ref.get();
      return res.json({ id: ref.id, ...fresh.data() });
    } catch (err) {
      console.error('[AVAILABILITY][UPDATE][ERROR]', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

// --------- DELETE (DELETE /:id) ---------
router.delete(
  '/:id',
  authGuard,
  [param('id').isString().notEmpty()],
  async (req, res) => {
    const invalid = ensureValid(req, res);
    if (invalid) return invalid;

    try {
      const partnerUid = req.user?.uid || req.user?.partnerUid || req.user?.sub;
      const ref = db.collection('partner_availability').doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Not found' });
      const data = snap.data();
      if (data.partnerUid !== partnerUid) return res.status(403).json({ error: 'Forbidden' });

      // Soft delete (active=false) pour garder l’historique
      await ref.update({
        active: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error('[AVAILABILITY][DELETE][ERROR]', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

// --------- PREVIEW (GET /preview?from=YYYY-MM-DD&to=YYYY-MM-DD) ---------
router.get(
  '/preview',
  authGuard,
  [
    query('from').isISO8601().withMessage('from is required YYYY-MM-DD'),
    query('to').isISO8601().withMessage('to is required YYYY-MM-DD'),
  ],
  async (req, res) => {
    const invalid = ensureValid(req, res);
    if (invalid) return invalid;

    try {
      const partnerUid = req.user?.uid || req.user?.partnerUid || req.user?.sub;
      const { weekly, overrides, all } = await getAvailabilityDocs(partnerUid);
      const tz = all[0]?.tz || 'America/Toronto';
      const days = applyWeeklyAndOverrides({
        weekly,
        overrides,
        from: DateTime.fromISO(req.query.from).toISODate(),
        to: DateTime.fromISO(req.query.to).toISODate(),
        tz,
      });
      return res.json({ tz, days });
    } catch (err) {
      console.error('[AVAILABILITY][PREVIEW][ERROR]', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

module.exports = router;
