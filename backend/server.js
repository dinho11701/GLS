// backend/server.js

require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

console.log("🔥🔥🔥 SERVER VERSION MYSQL CLEAN 🔥🔥🔥");
console.log("ENV EMAIL:", process.env.SUPPORT_EMAIL);

/* ---------- Middlewares maison ---------- */

const authGuard = require("./middleware/authGuard");
const ensurePartner = require("./middleware/ensurePartner");

/* ---------- Imports de routes ---------- */

// Auth
const customersAuthRoutes = require("./routes/auth/customers");
const partnersAuthRoutes = require("./routes/auth/partners");

// Categories
const categoriesRouter = require("./routes/categories");

// Partners
const partnersProfileRouter = require("./routes/partners/profile");
const partnersServicesRouter = require("./routes/partners/services");
const partnersReservationsRouter = require("./routes/partners/reservations");
const partnersAvailabilityRouter = require("./routes/partners/availability");
const partnersMessagesRouter = require("./routes/partners/messages");
const partnersSupportRouter = require("./routes/partners/support");
const partnersPaymentsRouter = require("./routes/partners/payments");
const partnersStatsRouter = require("./routes/partners/statistiques");
const partnersLookupRouter = require("./routes/partners/lookup");
const partnersZoneRouter = require("./routes/partners/zone");
const partnersRefundsRouter = require("./routes/partners/refunds");

// Customers
const customersProfileRouter = require("./routes/customers/profile");
const customersServicesRouter = require("./routes/customers/services");
const customersReservationsRouter = require("./routes/customers/reservations");
const customersReviewsRouter = require("./routes/customers/reviews");
const customersPendingReviewsRouter = require("./routes/customers/reviews_pending");
const customersPaymentsRouter = require("./routes/customers/payments");
const customersMessagesRouter = require("./routes/customers/messages");
const customersNotifsRouter = require("./routes/customers/notifs");
const { reservationScoped: customersReservationNotifsRouter } =
  require("./routes/customers/notifs");
const customersHostZonesRouter = require("./routes/customers/hostZones");
const customersUpgradeToPartnerRouter = require("./routes/customers/upgradeToPartner");
const customersLookupRouter = require("./routes/customers/lookup");

const app = express();

/* ---------- Middlewares globaux ---------- */

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(morgan("dev"));

/* ---------------- Health ---------------- */

app.get("/api/v1/health", (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    env: process.env.NODE_ENV || "dev"
  });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "API MySQL backend fonctionne ✅"
  });
});

/* ---------------- Auth ---------------- */

app.use("/api/v1/auth/customers", customersAuthRoutes);
app.use("/api/v1/auth/partners", partnersAuthRoutes);

/* ---------------- Categories ---------------- */

app.use("/api/v1/categories", categoriesRouter);

/* ---------------- Partners ---------------- */

app.use("/api/v1/partners/profile", authGuard, ensurePartner, partnersProfileRouter);

app.use("/api/v1/partners/services", authGuard, ensurePartner, partnersServicesRouter);

app.use("/api/v1/partners/reservations", authGuard, ensurePartner, partnersReservationsRouter);

app.use("/api/v1/partners/availability", authGuard, ensurePartner, partnersAvailabilityRouter);

app.use("/api/v1/partners/messages", authGuard, ensurePartner, partnersMessagesRouter);

app.use("/api/v1/partners/support", authGuard, ensurePartner, partnersSupportRouter);

app.use("/api/v1/partners/payments", authGuard, ensurePartner, partnersPaymentsRouter);

app.use("/api/v1/partners/statistiques", authGuard, ensurePartner, partnersStatsRouter);

app.use("/api/v1/partners/lookup", authGuard, ensurePartner, partnersLookupRouter);

app.use("/api/v1/partners/zone", authGuard, ensurePartner, partnersZoneRouter);

app.use("/api/v1/partners/refunds", authGuard, ensurePartner, partnersRefundsRouter);

/* ---------------- Customers ---------------- */

app.use("/api/v1/customers/services", customersServicesRouter);

app.use("/api/v1/customers/reservations", customersReservationNotifsRouter);
app.use("/api/v1/customers/reservations", customersReservationsRouter);

app.use("/api/v1/customers/reviews/pending", customersPendingReviewsRouter);
app.use("/api/v1/customers/reviews", customersReviewsRouter);

app.use("/api/v1/customers/payments", customersPaymentsRouter);

app.use("/api/v1/customers/messages", customersMessagesRouter);

app.use("/api/v1/customers/notifs", customersNotifsRouter);

app.use("/api/v1/customers/host-zones", customersHostZonesRouter);

app.use("/api/v1/customers/upgrade", customersUpgradeToPartnerRouter);

app.use("/api/v1/customers/lookup", customersLookupRouter);

app.use("/api/v1/customers/profile", customersProfileRouter);

/* ---------------- 404 ---------------- */

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl
  });
});

/* ---------------- Error handler ---------------- */

app.use((err, _req, res, _next) => {

  console.error("[SERVER ERROR]", err);

  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Internal Server Error"
  });

});

/* ---------------- Start server ---------------- */

const PORT = Number(process.env.PORT) || 5055;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 MySQL Backend lancé sur http://0.0.0.0:${PORT}`);
});