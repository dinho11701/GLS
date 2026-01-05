// backend/middleware/authGuard.js
const { admin } = require('../config/firebase');

/* -------------------------------------------------------------------------- */
/*                              Helper: parse token                            */
/* -------------------------------------------------------------------------- */
function parseBearer(header = '') {
  const h = String(header || '').trim();
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function withTimeout(promise, ms, label = 'verifyIdToken') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/* -------------------------------------------------------------------------- */
/*                                   GUARD                                    */
/* -------------------------------------------------------------------------- */
module.exports = async function authGuard(req, res, next) {
  console.log("------------------------------------------------");
  console.log("🔐 authGuard → Incoming request:");
  console.log("➡️", req.method, req.originalUrl);
  console.log("🔸 Headers:", req.headers);

  try {
    if (process.env.SKIP_AUTH === 'true') {
      console.log("⚠️ SKIP_AUTH active — bypass auth");
      req.user = { uid: 'dev-user', email: 'dev@local', claims: { dev: true } };
      return next();
    }

    if (req.method === 'OPTIONS') {
      console.log("🟦 OPTIONS preflight allowed");
      return res.sendStatus(204);
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
      console.log("❌ Missing Authorization header");
      return res.status(401).json({ ok: false, error: 'Missing Authorization header' });
    }

    console.log("🔑 Authorization header reçu:", authHeader);

    const token = parseBearer(authHeader);

    if (!token) {
      console.log("❌ Token mal formé, attendu: Bearer <idToken>");
      return res.status(401).json({ ok: false, error: 'Authorization must be: Bearer <idToken>' });
    }

    console.log("🟩 TOKEN EXTRACTED:", token.substring(0, 25) + "...");

    console.time('[authGuard] verifyIdToken');
    const decoded = await withTimeout(
      admin.auth().verifyIdToken(token),
      5000,
      'verifyIdToken'
    );
    console.timeEnd('[authGuard] verifyIdToken');

    console.log("✔ TOKEN DECODED:", {
      uid: decoded.uid,
      email: decoded.email,
      exp: decoded.exp,
      iat: decoded.iat,
    });

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      claims: decoded,
    };

    console.log("🔓 authGuard → ACCESS GRANTED → uid:", decoded.uid);
    console.log("------------------------------------------------");

    return next();
  } catch (err) {
    console.timeEnd('[authGuard] verifyIdToken');

    console.error("❌ authGuard ERROR:", err.message || err);

    const msg =
      err && /timeout/i.test(err.message)
        ? 'Auth timeout: please retry with a fresh idToken'
        : 'Invalid or expired token';

    console.log("🔐 authGuard → ACCESS DENIED →", msg);
    console.log("------------------------------------------------");

    return res.status(401).json({ ok: false, error: msg });
  }
};
