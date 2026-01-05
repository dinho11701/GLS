// routes/customers/reviews.js
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const firebase = require('../../config/firebase'); // doit exposer { db, admin? }
const authGuard = require('../../middleware/authGuard');

const db = firebase.db;
const admin = firebase.admin || require('firebase-admin'); // fallback si non exporté
const FieldValue = admin.firestore.FieldValue;

const router = express.Router();

/* ---------------- Helpers ---------------- */
function isValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ ok: false, errors: errors.array() });
    return false;
  }
  return true;
}
function isIndexError(err) {
  return err?.code === 9 && /requires an index/i.test(err?.message || '');
}

/**
 * POST /api/v1/customers/reviews
 * Body: { serviceId, rating (1..5), comment? }
 */
router.post(
  '/',
  authGuard,
  [
    body('serviceId').trim().notEmpty().withMessage('serviceId est requis'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('rating doit être un entier entre 1 et 5'),
    body('comment').optional().isString().isLength({ max: 2000 })
  ],
  async (req, res) => {
    if (!isValid(req, res)) return;

    try {
      const { serviceId, rating, comment = '' } = req.body;
      const customerId = req.user.uid;

      // 1) Service existe ?
      const serviceRef = db.collection('services').doc(serviceId);
      const serviceSnap = await serviceRef.get();
      if (!serviceSnap.exists) {
        return res.status(404).json({ ok: false, error: 'Service introuvable' });
      }

      // 2) Éligibilité: au moins une réservation passée pour ce service
      // -> pas d'index composite: on lit par customerId puis on filtre en mémoire
      const nowMs = Date.now();
      const resaByCustomer = await db
        .collection('reservations')
        .where('customerId', '==', customerId)
        .limit(50)
        .get();

      const hadPastRes = resaByCustomer.docs.some((d) => {
        const r = d.data();
        if (r.serviceId !== serviceId) return false;
        const endAt = r.endAt;
        let endMs = null;
        if (endAt && typeof endAt.toMillis === 'function') endMs = endAt.toMillis();
        else if (endAt && typeof endAt._seconds === 'number') endMs = endAt._seconds * 1000;
        else if (typeof endAt === 'number') endMs = endAt < 1e12 ? endAt * 1000 : endAt;
        return typeof endMs === 'number' && endMs < nowMs;
      });

      if (!hadPastRes) {
        return res.status(403).json({
          ok: false,
          error: "Vous devez avoir complété au moins une réservation pour ce service avant d'évaluer."
        });
      }

      // 3) Anti-doublon (1 avis par service et par client)
      const existing = await db
        .collection('reviews')
        .where('serviceId', '==', serviceId)
        .where('customerId', '==', customerId)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.status(409).json({ ok: false, error: 'Vous avez déjà laissé un avis pour ce service.' });
      }

      // 4) Création + MAJ agrégats transactionnelle (LECTURES AVANT ÉCRITURES)
      const reviewRef = db.collection('reviews').doc(); // id auto
      await db.runTransaction(async (tx) => {
        // LIRE d'abord
        const sSnap = await tx.get(serviceRef);
        if (!sSnap.exists) throw new Error('SERVICE_NOT_FOUND');
        const data = sSnap.data() || {};
        const ratingCount = Number(data.ratingCount || 0) + 1;
        const ratingSum   = Number(data.ratingSum || 0) + Number(rating);
        const ratingAvg   = Math.round((ratingSum / ratingCount) * 10) / 10;

        // ÉCRIRE ensuite
        tx.set(reviewRef, {
          id: reviewRef.id,
          serviceId,
          customerId,
          rating: Number(rating),
          comment,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(serviceRef, { ratingCount, ratingSum, ratingAvg });
      });

      const created = await reviewRef.get();
      return res.status(201).json({ ok: true, review: created.data() });
    } catch (err) {
      if (isIndexError(err)) {
        return res.status(400).json({
          ok: false,
          error: 'index_missing',
          message: 'Firestore: index composite requis pour cette requête (reviews: serviceId + createdAt desc). Déclare-le et redéploie.',
        });
      }
      console.error('[REVIEWS][CREATE][ERROR]', err?.stack || err);
      return res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
  }
);

/**
 * GET /api/v1/customers/reviews/:serviceId
 * Query: limit (1..25, def 10), cursor (docId)
 */
router.get(
  '/:serviceId',
  authGuard,
  [
    param('serviceId').trim().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 25 }),
    query('cursor').optional().isString()
  ],
  async (req, res) => {
    if (!isValid(req, res)) return;

    try {
      const { serviceId } = req.params;
      const limit  = Number(req.query.limit || 10);
      const cursor = req.query.cursor;

      // Service existe ?
      const serviceRef = db.collection('services').doc(serviceId);
      const sSnap = await serviceRef.get();
      if (!sSnap.exists) {
        return res.status(404).json({ ok: false, error: 'Service introuvable' });
      }

      let q = db
        .collection('reviews')
        .where('serviceId', '==', serviceId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (cursor) {
        const cursorDoc = await db.collection('reviews').doc(cursor).get();
        if (cursorDoc.exists) q = q.startAfter(cursorDoc);
      }

      const snap = await q.get();
      const reviews = snap.docs.map(d => d.data());
      const nextCursor = snap.size === limit ? reviews[reviews.length - 1]?.id : null;

      const { ratingAvg = null, ratingCount = 0 } = sSnap.data() || {};

      return res.json({
        ok: true,
        reviews,
        paging: { nextCursor, limit },
        aggregates: { ratingAvg, ratingCount }
      });
    } catch (err) {
      if (isIndexError(err)) {
        return res.status(400).json({
          ok: false,
          error: 'index_missing',
          message: 'Firestore: index composite requis pour cette requête (reviews: serviceId + createdAt desc). Déclare-le et redéploie.',
        });
      }
      console.error('[REVIEWS][LIST][ERROR]', err?.stack || err);
      return res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
  }
);

/**
 * PATCH /api/v1/customers/reviews/:id
 * (modifier son propre avis)
 */
router.patch(
  '/:id',
  authGuard,
  [
    param('id').notEmpty(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().isLength({ max: 2000 })
  ],
  async (req, res) => {
    if (!isValid(req, res)) return;

    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      const uid = req.user.uid;

      const reviewRef = db.collection('reviews').doc(id);
      const rSnap = await reviewRef.get();
      if (!rSnap.exists) return res.status(404).json({ ok: false, error: 'Avis introuvable' });

      const rData = rSnap.data();
      if (rData.customerId !== uid) return res.status(403).json({ ok: false, error: 'Non autorisé' });

      await db.runTransaction(async (tx) => {
        // LIRE d'abord
        const beforeSnap = await tx.get(reviewRef);
        if (!beforeSnap.exists) throw new Error('REVIEW_NOT_FOUND');
        const before = beforeSnap.data();

        const newRatingProvided = typeof rating !== 'undefined';
        const ratingChanged = newRatingProvided && Number(rating) !== before.rating;

        let sSnap, sData, diff = 0, serviceRef;
        if (ratingChanged) {
          diff = Number(rating) - Number(before.rating);
          serviceRef = db.collection('services').doc(before.serviceId);
          sSnap = await tx.get(serviceRef); // read BEFORE any write
          sData = sSnap.data() || {};
        }

        // ÉCRIRE ensuite
        const updates = { updatedAt: FieldValue.serverTimestamp() };
        if (typeof comment === 'string') updates.comment = comment;
        if (newRatingProvided) updates.rating = Number(rating);
        tx.update(reviewRef, updates);

        if (ratingChanged) {
          const ratingSum   = Number(sData.ratingSum || 0) + diff;
          const ratingCount = Number(sData.ratingCount || 0);
          const ratingAvg   = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
          tx.update(serviceRef, { ratingSum, ratingAvg });
        }
      });

      const updated = await reviewRef.get();
      return res.json({ ok: true, review: updated.data() });
    } catch (err) {
      console.error('[REVIEWS][PATCH][ERROR]', err?.stack || err);
      return res.status(500).json({ ok: false, error: 'Erreur serveur' });
    }
  }
);

module.exports = router;
