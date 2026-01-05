/**
 * Script de migration pour corriger `partnerUid` dans toutes les réservations
 *
 * ⚠️ À lancer MANUELLEMENT : `node scripts/fixReservationsPartnerUid.js`
 */

const admin = require("firebase-admin");

// 🧩 1. INITIALISATION FIREBASE ADMIN
// -----------------------------------
// Option A : tu as déjà un fichier de config (recommandé)
let db;
try {
  // adapte le chemin selon ton projet
  const firebaseConfig = require("../config/firebase");
  db = firebaseConfig.db || firebaseConfig.firestore || firebaseConfig.default;
  console.log("✅ Firestore initialisé via ../config/firebase");
} catch (e) {
  console.log("⚠️ Impossible de charger ../config/firebase, fallback avec serviceAccount.json");

  // Option B : tu utilises un serviceAccount local
  const serviceAccount = require("./serviceAccount.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
}

// 🧩 2. LOGIQUE DE RÉCUPÉRATION DU partnerUid À PARTIR DU SERVICE
// ---------------------------------------------------------------
async function getPartnerUidFromService(serviceId) {
  if (!serviceId) return null;

  const sRef = db.collection("services").doc(serviceId);
  const snap = await sRef.get();

  if (!snap.exists) {
    console.log(`❌ Service introuvable pour serviceId=${serviceId}`);
    return null;
  }

  const s = snap.data() || {};

  // 👉 Ici on essaie plusieurs champs possibles côté "services"
  const partnerUid =
    s.partnerUid ||  // ex: champ déjà existant
    s.ownerUid ||    // ex: si tu utilises ownerUid
    s.hostUid ||     // ex: si tu l’avais nommé comme ça
    null;

  if (!partnerUid) {
    console.log(`⚠️ Service ${serviceId} trouvé, mais aucun champ partnerUid/ownerUid/hostUid.`);
  }

  return partnerUid;
}

// 🧩 3. MIGRATION PRINCIPALE
// --------------------------
async function fixReservationsPartnerUid() {
  console.log("🚀 Démarrage de la migration des réservations...");

  const reservationsRef = db.collection("reservations");
  const snap = await reservationsRef.get();

  console.log(`📦 Total de réservations trouvées : ${snap.size}`);

  let updatedCount = 0;
  let skippedNoService = 0;
  let skippedNoPartner = 0;

  for (const doc of snap.docs) {
    const r = doc.data();
    const id = doc.id;

    const oldPartnerUid = r.partnerUid || null;
    const serviceId = r.serviceId || null;

    if (!serviceId) {
      console.log(`➡️ [${id}] skip (aucun serviceId)`);
      skippedNoService++;
      continue;
    }

    // Aller chercher le bon partnerUid depuis le service
    const correctPartnerUid = await getPartnerUidFromService(serviceId);

    if (!correctPartnerUid) {
      console.log(`➡️ [${id}] skip (service ${serviceId} sans partnerUid/ownerUid/hostUid)`);
      skippedNoPartner++;
      continue;
    }

    // Si déjà bon, on ne fait rien
    if (oldPartnerUid === correctPartnerUid) {
      console.log(`👌 [${id}] OK (partnerUid déjà correct : ${correctPartnerUid})`);
      continue;
    }

    // Sinon, on met à jour
    await doc.ref.update({
      partnerUid: correctPartnerUid,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `✅ [${id}] partnerUid corrigé : ${oldPartnerUid || "null"} ➜ ${correctPartnerUid}`
    );
    updatedCount++;
  }

  console.log("🎉 Migration terminée !");
  console.log(`   ✅ Réservations mises à jour : ${updatedCount}`);
  console.log(`   ↪️ Sans serviceId : ${skippedNoService}`);
  console.log(`   ↪️ Service sans partnerUid/ownerUid/hostUid : ${skippedNoPartner}`);

  process.exit(0);
}

// Lancer le script
fixReservationsPartnerUid().catch((err) => {
  console.error("💥 ERREUR pendant la migration :", err);
  process.exit(1);
});
