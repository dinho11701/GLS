// backend/routes/customers/notifs.js
const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const authGuard = require('../../middleware/authGuard');
const { db } = require('../../config/firebase');
const { DateTime } = require('luxon');

const router = express.Router();                         // /api/v1/customers/notifs
const reservationScoped = express.Router({ mergeParams: true }); // /api/v1/customers/reservations/*

// --- Helpers ---
function toHttpError(errors) {
  return { errors: errors.array().map(e => ({ field: e.path, msg: e.msg })) };
}
function assertValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json(toHttpError(errors));
}
function notifsCol(uid) {
  return db.collection('customers').doc(uid).collection('notifs');
}
function toDate(x) {
  if (!x) return null;
  if (typeof x.toDate === 'function') return x.toDate();
  if (typeof x === 'object' && typeof x._seconds === 'number') return new Date(x._seconds * 1000);
  if (x instanceof Date) return x;
  if (typeof x === 'number') return new Date(x);
  return null;
}
function fmtLocal(dt, tz, fmtStr = "cccc d LLLL yyyy 'à' HH:mm", locale = 'fr') {
  return DateTime.fromJSDate(dt, { zone: 'utc' }).setZone(tz).setLocale(locale).toFormat(fmtStr);
}

const ALLOWED_TYPES = new Set(['reservation', 'message', 'payment']);

/* ====== GET /api/v1/customers/notifs ====== */
router.get(
  '/',
  authGuard,
  [
    query('status').optional().isIn(['unread', 'read']),
    query('type').optional().isIn([...ALLOWED_TYPES]),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('since').optional().isISO8601(),
  ],
  async (req, res) => {
    if (assertValid(req, res)) return;
    const uid = req.user.uid;
    const { status, type, limit = 50, since } = req.query;

    try {
      let q = notifsCol(uid).orderBy('createdAt', 'desc').limit(Number(limit));
      if (status) q = q.where('status', '==', status);
      if (type) q = q.where('type', '==', type);
      if (since) q = q.where('createdAt', '>=', new Date(since));

      const snap = await q.get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: 'LIST_FAILED', details: String(e) });
    }
  }
);

/* ====== GET /api/v1/customers/notifs/counters ====== */
router.get('/counters', authGuard, async (req, res) => {
  const uid = req.user.uid;
  try {
    const snap = await notifsCol(uid).where('status', '==', 'unread').get();
    const counters = { total: 0, byType: { reservation: 0, message: 0, payment: 0 } };
    snap.forEach(doc => {
      counters.total += 1;
      const t = doc.get('type');
      if (ALLOWED_TYPES.has(t)) counters.byType[t] += 1;
    });
    res.json(counters);
  } catch (e) {
    res.status(500).json({ error: 'COUNTERS_FAILED', details: String(e) });
  }
});

/* ====== POST /api/v1/customers/notifs (tests/générique) ====== */
router.post(
  '/',
  authGuard,
  [
    body('type').exists().isIn([...ALLOWED_TYPES]),
    body('title').exists().isString().isLength({ min: 1, max: 120 }),
    body('body').optional().isString().isLength({ max: 1000 }),
    body('data').optional().isObject(),
  ],
  async (req, res) => {
    if (assertValid(req, res)) return;
    const uid = req.user.uid;
    const { type, title, body: text, data = {} } = req.body;

    try {
      const payload = {
        type,
        title,
        body: text || '',
        data,
        status: 'unread',
        createdAt: new Date(),
        readAt: null,
      };
      const ref = await notifsCol(uid).add(payload);
      res.status(201).json({ id: ref.id, ...payload });
    } catch (e) {
      res.status(500).json({ error: 'CREATE_FAILED', details: String(e) });
    }
  }
);

/* ====== PATCH /api/v1/customers/notifs/:id/read ====== */
router.patch(
  '/:id/read',
  authGuard,
  [param('id').isString().isLength({ min: 5 })],
  async (req, res) => {
    if (assertValid(req, res)) return;
    const uid = req.user.uid;
    const { id } = req.params;

    try {
      const ref = notifsCol(uid).doc(id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'NOTIF_NOT_FOUND' });

      await ref.update({ status: 'read', readAt: new Date() });
      const updated = (await ref.get()).data();
      res.json({ id, ...updated });
    } catch (e) {
      res.status(500).json({ error: 'MARK_READ_FAILED', details: String(e) });
    }
  }
);

/* ====== PATCH /api/v1/customers/notifs/read-all ====== */
router.patch('/read-all', authGuard, async (req, res) => {
  const uid = req.user.uid;
  try {
    const snap = await notifsCol(uid).where('status', '==', 'unread').get();
    const batch = db.batch();
    snap.forEach(d => batch.update(d.ref, { status: 'read', readAt: new Date() }));
    await batch.commit();
    res.json({ ok: true, updated: snap.size });
  } catch (e) {
    res.status(500).json({ error: 'READ_ALL_FAILED', details: String(e) });
  }
});

/* ====== DELETE /api/v1/customers/notifs/:id ====== */
router.delete(
  '/:id',
  authGuard,
  [param('id').isString().isLength({ min: 5 })],
  async (req, res) => {
    if (assertValid(req, res)) return;
    const uid = req.user.uid;
    const { id } = req.params;
    try {
      await notifsCol(uid).doc(id).delete();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DELETE_FAILED', details: String(e) });
    }
  }
);

/* ====== SCOPÉ: POST /api/v1/customers/reservations/:reservationId/notifs ====== */
reservationScoped.post(
  '/:reservationId/notifs',
  authGuard,
  [
    param('reservationId').isString().isLength({ min: 6 }),
    body('title').exists().isString().isLength({ min: 1, max: 120 }),
    body('body').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res) => {
    if (assertValid(req, res)) return;
    const uid = req.user.uid;
    const { reservationId } = req.params;
    const { title, body: text } = req.body;

    try {
      const rDoc = await db.collection('reservations').doc(reservationId).get();
      if (!rDoc.exists) return res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });
      const r = rDoc.data();
      if (r.customerId !== uid) return res.status(403).json({ error: 'FORBIDDEN' });

      const tz = r.tz || 'America/Toronto';
      const startDate = toDate(r.startAt);
      let whenTxt = null;

      if (startDate) {
        whenTxt = fmtLocal(startDate, tz, "cccc d LLLL yyyy 'à' HH:mm");
      } else if (r.calendar?.date && r.calendar?.time) {
        const isoGuess = `${r.calendar.date}T${r.calendar.time}:00`;
        const dt = DateTime.fromISO(isoGuess, { zone: tz }).toJSDate();
        whenTxt = fmtLocal(dt, tz, "cccc d LLLL yyyy 'à' HH:mm");
      }

      const defaultBody = whenTxt
        ? `Votre réservation ${reservationId} est confirmée pour ${whenTxt}.`
        : `Votre réservation ${reservationId} est confirmée.`;

      const payload = {
        type: 'reservation',
        title,
        body: text || defaultBody,
        data: { reservationId },
        status: 'unread',
        createdAt: new Date(),
        readAt: null,
      };

      const ref = await notifsCol(uid).add(payload);
      res.status(201).json({ id: ref.id, ...payload });
    } catch (e) {
      res.status(500).json({ error: 'CREATE_FOR_RESERVATION_FAILED', details: String(e) });
    }
  }
);

/* ============================================================
   SCOPÉ : POST /api/v1/customers/payments/:id/notifs
   Crée une notification liée à un paiement
============================================================ */
router.post(
  '/payments/:paymentId/notifs',
  authGuard,
  [
    param('paymentId').isString().isLength({ min: 6 }),
    body('status').exists().isIn(['pending', 'succeeded', 'failed']),
  ],
  async (req, res) => {
    if (assertValid(req, res)) return;

    const uid = req.user.uid;
    const { paymentId } = req.params;
    const { status } = req.body;

    try {
      const pDoc = await db.collection('payments').doc(paymentId).get();
      if (!pDoc.exists) return res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });

      const p = pDoc.data();
      if (p.clientId !== uid) return res.status(403).json({ error: 'FORBIDDEN' });

      const amount = (p.amount / 100).toFixed(2);
      const currency = p.currency;

      let title = '';
      let body = '';

      if (status === 'pending') {
        title = 'Paiement en cours';
        body = `Votre paiement pour le service ${p.serviceId} est en cours de traitement.`;
      }

      if (status === 'succeeded') {
        title = 'Paiement réussi';
        body = `Votre paiement de ${amount} ${currency} a été confirmé.`;
      }

      if (status === 'failed') {
        title = 'Échec du paiement';
        body = `Votre paiement pour le service ${p.serviceId} n’a pas pu être effectué.`;
      }

      const payload = {
        type: 'payment',
        title,
        body,
        data: {
          paymentId,
          contractId: p.contractId,
          serviceId: p.serviceId,
        },
        status: 'unread',
        createdAt: new Date(),
        readAt: null,
      };

      const ref = await notifsCol(uid).add(payload);
      return res.status(201).json({ id: ref.id, ...payload });

    } catch (e) {
      console.error('[CUSTOMER-PAYMENT-NOTIF][ERROR]', e);
      return res.status(500).json({ error: 'CREATE_PAYMENT_NOTIF_FAILED', details: String(e) });
    }
  }
);


module.exports = router;
module.exports.reservationScoped = reservationScoped;
