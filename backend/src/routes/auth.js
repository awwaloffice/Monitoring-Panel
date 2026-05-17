const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../db/migrate");
const { authenticate, logAudit } = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "changeme_super_secret_key";

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  const db = getDb();
  try {
    const user = await db("users").where({ username, status: "active" }).first();
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      logAudit(db, { username, action: "login", module: "auth", ip_address: req.ip, status: "failed" });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    await db("users").where({ id: user.id }).update({ last_login: new Date().toISOString() });
    logAudit(db, { user_id: user.id, username: user.username, action: "login", module: "auth", ip_address: req.ip });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", authenticate, async (req, res) => {
  logAudit(getDb(), { user_id: req.user.id, username: req.user.username, action: "logout", module: "auth", ip_address: req.ip });
  res.json({ message: "Logged out" });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await getDb()("users").select("id","name","username","role","status","last_login","created_at").where({ id: req.user.id }).first();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

router.put("/change-password", authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: "Both passwords required" });
  const db = getDb();
  const user = await db("users").where({ id: req.user.id }).first();
  if (!bcrypt.compareSync(current_password, user.password_hash)) return res.status(400).json({ error: "Current password incorrect" });
  await db("users").where({ id: req.user.id }).update({ password_hash: bcrypt.hashSync(new_password, 10) });
  res.json({ message: "Password changed" });
});

module.exports = router;
