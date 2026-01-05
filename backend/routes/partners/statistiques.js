// routes/partners/statistiques.js
const express = require('express');
const { query, validationResult } = require('express-validator');
const { DateTime } = require('luxon');
const { db } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();

/**
 * Helpers
 */
const toISODate = (dt) => dt.toISODate(); // YYYY-MM-DD
const chunk = (arr, size = 30) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const asNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const VALID_GROUPS = new Set(['day', 'week', 'month']);
const STATUS_REVENUE = new Set(['confirmed', 'completed']); // 💰 comptabilisés

/**
 * GET /api/v1/partners/statistiques
 * Auth: Bearer <idToken>
 *
 * Query (optionnel) :
 *  - from: ISO (inclu), ex: 2025-09-01
 *  - to:   ISO (exclu), ex: 2025-10-01
 *  - tz:   IANA timezone (def: America/Toronto)
 *  - groupBy: day|week|month (def: day)
 *  - limitSamples: nb d’items dans samples (def: 5)
 *
 * Réponse:
 * {
 *   period: {...},
 *   kpis: {...},
 *   series: { revenueByPeriod:[], reservationsByStatus:[], ratings:{...} },
 *   samples: { reservations:[], reviews:[] }
 * }
 */
router.get(
  '/',
  authGuard,
  [
    query('from').optional().isISO8601().withMessage('from must be ISO date'),
    query('to').optional().isISO8601().withMessage('to must be ISO date'),
    query('tz').optional().isString(),
    query('groupBy').optional().isIn([...VALID_GROUPS]),
    query('limitSamples').optional().isInt({ min: 0, max: 50 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const partnerUid = req.user?.uid;
      if (!partnerUid) return res.status(401).json({ message: 'Unauthorized' });

      const tz = req.query.tz || 'America/Toronto';
      const groupBy = req.query.groupBy || 'day';
      const limitSamples = req.query.limitSamples ? parseInt(req.query.limitSamples, 10) : 5;

      // Fenêtre temporelle
      const now = DateTime.now().setZone(tz);
      const from = req.query.from
        ? DateTime.fromISO(req.query.from, { zone: tz }).startOf('day')
        : now.minus({ days: 30 }).startOf('day');
      const to = req.query.to
        ? DateTime.fromISO(req.query.to, { zone: tz }).startOf('day')
        : now.plus({ days: 1 }).startOf('day'); // exclusif

      // Regroupement: normalise un bucket-string (YYYY-MM[-WW]).
      const bucketKey = (dt) => {
        const d = DateTime.fromMillis(dt.toMillis ? dt.toMillis() : dt, { zone: tz });
        if (groupBy === 'month') return d.toFormat('yyyy-LL');
        if (groupBy === 'week') return `${d.weekYear}-W${String(d.weekNumber).padStart(2, '0')}`;
        return d.toISODate();
      };

      // ---- 1) Récup réservations
      // On suppose collection 'reservations' avec champ partnerUid et startAt (Timestamp).
      const reservationsSnap = await db
        .collection('reservations')
        .where('partnerUid', '==', partnerUid)
        .where('startAt', '>=', new Date(from.toISO()))
        .where('startAt', '<', new Date(to.toISO()))
        .get();

      const reservations = reservationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ---- 2) KPIs & séries (réservations + revenus)
      const currency = reservations.find((r) => r.currency)?.currency || 'CAD';

      const seriesRevenue = new Map(); // bucket -> amount
      const seriesByStatus = new Map(); // status -> Map(bucket -> count)

      let reservationsTotal = 0;
      let reservationsCancelled = 0;
      let reservationsConfirmed = 0;
      let revenueTotal = 0;
      let pricesConfirmedCount = 0;

      for (const r of reservations) {
        reservationsTotal += 1;

        const status = (r.status || 'unknown').toLowerCase();
        if (status === 'cancelled') reservationsCancelled += 1;
        if (STATUS_REVENUE.has(status)) reservationsConfirmed += 1;

        // Grouping key (based on startAt or calendar.date if needed)
        const start =
          r.startAt?._seconds
            ? DateTime.fromSeconds(r.startAt._seconds, { zone: tz })
            : r.calendar?.date
            ? DateTime.fromISO(r.calendar.date, { zone: tz })
            : null;
        const bucket = start ? (groupBy === 'month' ? start.toFormat('yyyy-LL')
                          : groupBy === 'week' ? `${start.weekYear}-W${String(start.weekNumber).padStart(2, '0')}`
                          : start.toISODate()) : 'unknown';

        // Reservations par statut
        if (!seriesByStatus.has(status)) seriesByStatus.set(status, new Map());
        const m = seriesByStatus.get(status);
        m.set(bucket, (m.get(bucket) || 0) + 1);

        // Revenus (seulement confirmed/completed & price numérique)
        if (STATUS_REVENUE.has(status)) {
          const price = asNumber(r.price);
          if (price > 0) {
            seriesRevenue.set(bucket, (seriesRevenue.get(bucket) || 0) + price);
            revenueTotal += price;
            pricesConfirmedCount += 1;
          }
        }
      }

      const avgPriceConfirmed = pricesConfirmedCount ? revenueTotal / pricesConfirmedCount : 0;
      const conversionRate =
        reservationsTotal ? (reservationsConfirmed / reservationsTotal) * 100 : 0;

      // Séries -> tableaux triés par bucket
      const sortedRevenueSeries = [...seriesRevenue.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucket, amount]) => ({ bucket, amount, currency }));

      const reservationsByStatus = [...seriesByStatus.entries()].map(([status, bucketMap]) => ({
        status,
        data: [...bucketMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([bucket, count]) => ({ bucket, count })),
      }));

      // ---- 3) Reviews (évaluations)
      // On part des services présents dans les réservations de la période (plus simple et rapide).
      const serviceIds = Array.from(new Set(reservations.map((r) => r.serviceId).filter(Boolean)));
      let reviews = [];
      if (serviceIds.length) {
        for (const group of chunk(serviceIds, 30)) {
          const snap = await db.collection('reviews').where('serviceId', 'in', group).get();
          reviews.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      }

      const ratings = reviews.map((r) => asNumber(r.rating)).filter((x) => x > 0);
      const ratingsCount = ratings.length;
      const avgRating = ratingsCount
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratingsCount) * 100) / 100
        : 0;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of ratings) {
        const k = String(Math.max(1, Math.min(5, Math.round(r))));
        distribution[k] += 1;
      }

      // ---- 4) Réponse
      return res.json({
        period: {
          from: toISODate(from),
          to: toISODate(to),
          tz,
          groupBy,
        },
        kpis: {
          reservations_total: reservationsTotal,
          reservations_confirmed: reservationsConfirmed,
          reservations_cancelled: reservationsCancelled,
          conversion_rate_pct: Math.round(conversionRate * 10) / 10,
          revenue_total: Math.round(revenueTotal * 100) / 100,
          revenue_currency: currency,
          avg_price_confirmed: Math.round(avgPriceConfirmed * 100) / 100,
          avg_rating: avgRating,
          reviews_count: ratingsCount,
        },
        series: {
          revenueByPeriod: sortedRevenueSeries, // [{bucket, amount, currency}]
          reservationsByStatus,                // [{status, data:[{bucket,count}]}]
          ratings: {
            avg: avgRating,
            count: ratingsCount,
            distribution,
          },
        },
        samples: {
          reservations: reservations.slice(0, limitSamples),
          reviews: reviews.slice(0, limitSamples),
        },
      });
    } catch (err) {
      console.error('[STATS][ERROR]', err);
      res.status(500).json({ message: 'Internal error', error: String(err?.message || err) });
    }
  }
);

module.exports = router;
