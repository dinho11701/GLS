// backend/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const firebase = require('./config/firebase');
const { projectId } = firebase;

/* ---------- Middlewares maison ---------- */
const authGuard     = require('./middleware/authGuard');
const ensurePartner = require('./middleware/ensurePartner');

/* ---------- Imports de routes ---------- */
// Auth
const customersAuthRoutes        = require('./routes/auth/customers');
const partnersAuthRoutes         = require('./routes/auth/partners');

// Partners
const partnersProfileRouter      = require('./routes/partners/profile');
const partnersServicesRouter     = require('./routes/partners/services');
const partnersReservationsRouter = require('./routes/partners/reservations');
const partnersAvailabilityRouter = require('./routes/partners/availability');
const partnersMessagesRouter     = require('./routes/partners/messages');
const partnersSupportRouter      = require('./routes/partners/support');
const partnersPaymentsRouter     = require('./routes/partners/payments');
const partnersStatsRouter        = require('./routes/partners/statistiques');
const partnersLookupRouter       = require('./routes/partners/lookup');
const partnersZoneRouter         = require('./routes/partners/zone');

// Customers
const customersProfileRouter = require('./routes/customers/profile');
const customersServicesRouter     = require('./routes/customers/services');
const customersReservationsRouter = require('./routes/customers/reservations');
const customersReviewsRouter      = require('./routes/customers/reviews');
const customersPendingReviewsRouter = require('./routes/customers/reviews_pending');
const customersPaymentsRouter     = require('./routes/customers/payments');
const customersMessagesRouter     = require('./routes/customers/messages');
const customersNotifsRouter       = require('./routes/customers/notifs');
const { reservationScoped: customersReservationNotifsRouter } =
  require('./routes/customers/notifs');

const customersHostZonesRouter   = require('./routes/customers/hostZones');
const customersUpgradeToPartnerRouter = require('./routes/customers/upgradeToPartner');
const customersLookupRouter      = require('./routes/customers/lookup');

const app = express();

/* ---------- Middlewares globaux ---------- */
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[WARN] STRIPE_SECRET_KEY manquante.');
}

/* ---------------- Health & Root ---------------- */
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV || 'dev' });
});
app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, message: 'API backend fonctionne ✅' });
});

/* ---------------- Montage des routes ---------------- */
// Auth
app.use('/api/v1/auth',     customersAuthRoutes);
app.use('/api/v1/partners', partnersAuthRoutes);

/* ---- Partners (protégé: authGuard + ensurePartner) ---- */
app.use('/api/v1/partners',              authGuard, ensurePartner, partnersProfileRouter);
app.use('/api/v1/partners',              authGuard, ensurePartner, partnersServicesRouter);
app.use('/api/v1/partners/reservations', authGuard, ensurePartner, partnersReservationsRouter);
app.use('/api/v1/partners/availability', authGuard, ensurePartner, partnersAvailabilityRouter);
app.use('/api/v1/partners/statistiques', authGuard, ensurePartner, partnersStatsRouter);
app.use('/api/v1/partners/messages',     authGuard, ensurePartner, partnersMessagesRouter);
app.use('/api/v1/partners/support',      authGuard, ensurePartner, partnersSupportRouter);
app.use('/api/v1/partners/payments',     authGuard, ensurePartner, partnersPaymentsRouter);
app.use('/api/v1/partners',              authGuard, ensurePartner, partnersLookupRouter);
app.use('/api/v1/partners/zone',         authGuard, ensurePartner, partnersZoneRouter);

/* ---- Customers ---- */
app.use('/api/v1/customers/services',     customersServicesRouter);

app.use('/api/v1/customers/reservations', customersReservationNotifsRouter);
app.use('/api/v1/customers/reservations', customersReservationsRouter);

// ⭐ IMPORTANT : ordre correct + pas de duplicata
app.use('/api/v1/customers/reviews/pending', customersPendingReviewsRouter);
app.use('/api/v1/customers/reviews',         customersReviewsRouter);

app.use('/api/v1/customers/payments',     customersPaymentsRouter);
app.use('/api/v1/customers/messages',     customersMessagesRouter);
app.use('/api/v1/customers/notifs',       customersNotifsRouter);

app.use('/api/v1/customers',              customersHostZonesRouter);
app.use('/api/v1/customers',              customersUpgradeToPartnerRouter);
app.use('/api/v1/customers',              customersLookupRouter);

/* ⭐⭐ MONTER LA ROUTE PROFIL À LA FIN ⭐⭐ */
app.use('/api/v1/customers', customersProfileRouter);

/* --- Health Firebase --- */
app.get('/api/v1/health/firebase', (_req, res) => {
  res.status(200).json({ ok: true, adminProjectId: projectId || null });
});

/* --- Qui suis-je (partners) --- */
app.get('/api/v1/partners/_whoami', authGuard, (req, res) => {
  res.json({
    ok: true,
    uid: req.user?.uid,
    email: req.user?.email || null,
    claims: req.user?.claims || {},
  });
});

/* ---------------- 404 & Error Handler ---------------- */
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found', path: req.originalUrl });
});
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal Server Error' });
});


/* --------------------------------------------------------
   CRON AUTO : débloquer les avis après fin des sessions
-------------------------------------------------------- */
const path = require("path");
const { DateTime } = require("luxon");
const admin = require("firebase-admin");

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(
        require(path.join(__dirname, "serviceAccountKey.json"))
      ),
    });
  }
} catch (err) {
  console.error("Firebase admin init error:", err);
}

const cronDb = admin.firestore();

async function processReviewsCron() {
  const now = DateTime.now().setZone("America/Toronto");

  try {
    const snap = await cronDb
      .collection("reservations")
      .where("status", "==", "accepted")
      .get();

    for (const doc of snap.docs) {
      const r = doc.data();

      if (r.review?.submitted === true) continue;

      const start = DateTime.fromISO(
        `${r.calendar?.date}T${r.calendar?.time}`,
        { zone: "America/Toronto" }
      );

      const end = start.plus({ minutes: r.durationMin });

      if (now < end) continue;

      await doc.ref.update({
        review: {
          needsReview: true,
          submitted: false,
          rating: null,
          comment: null,
        },
      });

      console.log(`⭐ Avis activé pour réservation ${doc.id}`);
    }
  } catch (err) {
    console.error("[CRON][REVIEWS] ERROR:", err);
  }
}

// chaque 60s
setInterval(processReviewsCron, 60 * 1000);
console.log("⏳ Cron reviews activé (60s)");

/* ---------------- Lancement ---------------- */
const PORT = Number(process.env.PORT) || 5055;
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur http://127.0.0.1:${PORT}`);
});
