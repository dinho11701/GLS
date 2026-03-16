const { DateTime } = require("luxon");
const { db } = require("../config/firebase");

/* -----------------------------------------------------------
   Utils
----------------------------------------------------------- */
function mm(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

// ISO (1=lun … 7=dim) ➜ JS (0=dim … 6=sam)
function isoToJsWeekday(iso) {
  return iso === 7 ? 0 : iso;
}

module.exports.checkAvailability = async ({
  partnerUid,
  serviceId,
  date,       // YYYY-MM-DD
  startTime,  // HH:mm
  endTime,    // HH:mm
}) => {
  const TZ = "America/Toronto";

  /* -----------------------------------------------------------
     Construire les DateTime (LOCAL TZ)
  ----------------------------------------------------------- */
  const startDt = DateTime.fromISO(`${date}T${startTime}`, { zone: TZ });
  const endDt   = DateTime.fromISO(`${date}T${endTime}`,   { zone: TZ });

  if (!startDt.isValid || !endDt.isValid)
    return { ok: false, reason: "Heures invalides." };

  if (endDt <= startDt)
    return { ok: false, reason: "L’heure de fin doit être après l’heure de début." };

  /* -----------------------------------------------------------
     Charger le service
  ----------------------------------------------------------- */
  const svcDoc = await db.collection("services").doc(serviceId).get();
  if (!svcDoc.exists)
    return { ok: false, reason: "Service introuvable." };

  const svc = svcDoc.data();

  const svcStart = svc.Availability?.startTime;
  const svcEnd   = svc.Availability?.endTime;
  const svcDays  = svc.Availability?.days || []; // ISO 1..7

  if (!svcStart || !svcEnd)
    return { ok: false, reason: "Ce service n’a pas d’horaires configurés." };

  /* -----------------------------------------------------------
     Jour ISO (service)
  ----------------------------------------------------------- */
  const isoWeekday = startDt.weekday; // 1..7

  if (svcDays.length > 0 && !svcDays.includes(isoWeekday))
    return { ok: false, reason: "Ce service n’est pas offert ce jour-là." };

  /* -----------------------------------------------------------
     Vérifier intervalle du service
  ----------------------------------------------------------- */
  const svcStartDt = DateTime.fromISO(`${date}T${svcStart}`, { zone: TZ });
  const svcEndDt   = DateTime.fromISO(`${date}T${svcEnd}`,   { zone: TZ });

  if (startDt < svcStartDt || endDt > svcEndDt)
    return { ok: false, reason: "L’horaire choisi n’est pas disponible pour ce service." };

  /* -----------------------------------------------------------
     Disponibilité de l’hôte (weekly + override)
  ----------------------------------------------------------- */
  const snap = await db
    .collection("partner_availability")
    .where("partnerUid", "==", partnerUid)
    .where("active", "==", true)
    .get();

  const items = snap.docs.map(d => d.data());
  const weekly    = items.filter(d => d.kind === "weekly");
  const overrides = items.filter(d => d.kind === "override");

  const override = overrides.find(o => o.date === date);

  /* ---------------- OVERRIDE (prioritaire) ---------------- */
  if (override) {
    if (override.closed)
      return { ok: false, reason: "L’hôte n’est pas disponible à cette date." };

    const okRange = override.ranges?.some(r =>
      mm(startTime) >= mm(r.start) &&
      mm(endTime)   <= mm(r.end)
    );

    if (!okRange)
      return { ok: false, reason: "L’horaire sélectionné n’est pas disponible cette journée-là." };
  }

  /* ---------------- WEEKLY ---------------- */
  else {
    const jsWeekday = isoToJsWeekday(isoWeekday); // ✅ conversion explicite

    console.log("CHECK WEEKDAY", {
    date,
    isoWeekday,
    jsWeekday,
    weeklyDays: weekly.map(w => w.day),
  });

    const w = weekly.find(w => w.day === jsWeekday);

    if (!w)
      return { ok: false, reason: "L’hôte ne travaille pas ce jour-là." };

    if (w.closed)
      return { ok: false, reason: "L’hôte est fermé ce jour-là." };

    const okRange = w.ranges?.some(r =>
      mm(startTime) >= mm(r.start) &&
      mm(endTime)   <= mm(r.end)
    );

    if (!okRange)
      return { ok: false, reason: "Cet horaire n’est pas disponible pour l’hôte." };
  }

  /* -----------------------------------------------------------
     Conflits avec autres réservations
  ----------------------------------------------------------- */
  const resSnap = await db
    .collection("reservations")
    .where("partnerUid", "==", partnerUid)
    .where("calendar.date", "==", date)
    .get();

  for (const doc of resSnap.docs) {
    const r = doc.data();
    if (["cancelled", "refused"].includes(r.status)) continue;

    const rStart = DateTime.fromISO(`${date}T${r.calendar.time}`, { zone: TZ });
    const rEnd   = rStart.plus({ minutes: r.durationMin });

    if (!(endDt <= rStart || startDt >= rEnd))
      return { ok: false, reason: "Ce créneau est déjà réservé." };
  }

  /* -----------------------------------------------------------
     Capacité
  ----------------------------------------------------------- */
  const capacity = svc.Availability?.instances || 1;
  const activeBookings = resSnap.docs.filter(
    d => !["cancelled", "refused"].includes(d.data().status)
  ).length;

  if (activeBookings >= capacity)
    return { ok: false, reason: "Il ne reste plus de places pour ce service." };

  /* -----------------------------------------------------------
     OK ✔
  ----------------------------------------------------------- */
  return { ok: true };
};