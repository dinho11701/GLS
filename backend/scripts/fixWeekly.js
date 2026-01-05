// scripts/fixWeekly.js
// -----------------------------------------------------
// MIGRATION partner_availability — utilise ton backend
// -----------------------------------------------------

// ⛔️ AU LIEU DE INITIALISER FIREBASE ADMIN ICI,
// on réutilise TON backend déjà configuré.
const path = require("path");
require("dotenv").config();

const { db } = require("../config/firebase"); 
// <-- IMPORTANT : prend ton instance déjà initialisée

// Convert "HH:mm" → minutes
const mm = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Normalise "9:0" → "09:00"
const normalizeTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

async function fixWeekly() {
  console.log("----------------------------------------------------");
  console.log("📌 MIGRATION PARTNER_AVAILABILITY : weekly correction");
  console.log("----------------------------------------------------");

  const snap = await db.collection("partner_availability").get();

  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.kind !== "weekly") continue;

    let modified = false;
    let fixed = { ...data };

    // 1️⃣ Vérifier day
    if (typeof fixed.day !== "number" || fixed.day < 0 || fixed.day > 6) {
      console.log("⚠️ Mauvais `day`, fix :", fixed.day);
      fixed.day = 0; // au pire remet dimanche
      modified = true;
    }

    // 2️⃣ Normaliser les ranges
    if (Array.isArray(fixed.ranges)) {
      const ranges = [];
      for (const r of fixed.ranges) {
        if (!r.start || !r.end) continue;
        const s = normalizeTime(r.start);
        const e = normalizeTime(r.end);
        if (mm(e) > mm(s)) {
          ranges.push({ start: s, end: e });
        } else {
          console.log("⚠️ Range inversé supprimé :", r);
        }
      }
      if (JSON.stringify(ranges) !== JSON.stringify(fixed.ranges)) {
        fixed.ranges = ranges;
        modified = true;
      }
    }

    // 3️⃣ closed true mais ranges > 0
    if (fixed.closed === true && fixed.ranges?.length > 0) {
      console.log("🛠 Fix closed→false (ranges existantes)");
      fixed.closed = false;
      modified = true;
    }

    // 4️⃣ closed false mais aucune range
    if (fixed.closed === false && (!fixed.ranges || fixed.ranges.length === 0)) {
      console.log("🛠 Fix closed→true (aucune range)");
      fixed.closed = true;
      modified = true;
    }

    if (modified) {
      await doc.ref.update(fixed);
      count++;
    }
  }

  console.log(`\n✅ Migration terminée → ${count} documents corrigés.`);
}

fixWeekly()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("🔥 ERROR FIX WEEKLY :", e);
    process.exit(1);
  });
