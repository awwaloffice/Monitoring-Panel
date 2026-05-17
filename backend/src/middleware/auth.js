const jwt = require("jsonwebtoken");
const { getDb } = require("../db/migrate");

const JWT_SECRET = process.env.JWT_SECRET || "changeme_super_secret_key";

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    next();
  };
}

// Async audit log helper (fire-and-forget)
function logAudit(db, { user_id, username, action, module, target, ip_address, details, status }) {
  db("audit_logs").insert({ user_id, username, action, module, target, ip_address, details: JSON.stringify(details || {}), status: status || "success" }).catch(() => {});
}

module.exports = { authenticate, requireRole, logAudit };
