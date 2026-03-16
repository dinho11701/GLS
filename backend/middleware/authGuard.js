const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

module.exports = function (req, res, next) {
  console.log("🔥 AUTH GUARD HIT");

  const authHeader = req.headers.authorization;

  console.log("👉 Authorization header:", authHeader);

  if (!authHeader) {
    console.log("❌ No Authorization header");
    return res.status(401).json({ error: "No token provided" });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.log("❌ Malformed Authorization header");
    return res.status(401).json({ error: "Malformed token" });
  }

  const token = parts[1];

  console.log("🟡 Token received:", token);
  console.log("🔐 JWT_SECRET used:", JWT_SECRET);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    console.log("🟢 Decoded token:", decoded);

    req.user = decoded;

    return next();
  } catch (err) {
    console.log("❌ JWT VERIFY ERROR:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};