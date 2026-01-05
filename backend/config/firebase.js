// backend/config/firebase.js
const admin = require('firebase-admin');
require('dotenv').config();

let initialized = false;
let projectId = null;

try {
  // A) Service account inline via env
  if (process.env.SERVICE_ACCOUNT_JSON) {
    const svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      projectId: svc.project_id,
    });
    projectId = svc.project_id;
    console.log(`✅ Firebase initialisé via SERVICE_ACCOUNT_JSON (projectId=${projectId})`);
    initialized = true;
  }
} catch (e) {
  console.error('❌ Erreur parsing SERVICE_ACCOUNT_JSON:', e.message);
}

if (!initialized) {
  try {
    // B) Fichier local (dev)
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    projectId = serviceAccount.project_id;
    console.log(`✅ Firebase initialisé via serviceAccountKey.json (projectId=${projectId})`);
    initialized = true;
  } catch (e) {
    // pas de fichier local
  }
}

if (!initialized && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // C) Application Default Credentials
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '(inconnu)';
  console.log(`✅ Firebase initialisé via GOOGLE_APPLICATION_CREDENTIALS (projectId=${projectId})`);
  initialized = true;
}

if (!initialized) {
  console.error(
    '❌ Firebase Admin non initialisé. Ajoute `serviceAccountKey.json` dans backend/, ou définis SERVICE_ACCOUNT_JSON, ou GOOGLE_APPLICATION_CREDENTIALS.'
  );
  process.exit(1);
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, projectId };
