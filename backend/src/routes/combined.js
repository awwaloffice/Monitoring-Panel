// ── users.js ──────────────────────────────────────────────────────────────
const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db/migrate");
const { authenticate, requireRole, logAudit } = require("../middleware/auth");

const usersRouter = express.Router();
usersRouter.use(authenticate, requireRole("full_access"));

usersRouter.get("/", async (req, res) => {
  try {
    res.json(
      await getDb()("users")
        .select("id", "name", "username", "role", "status", "last_login", "created_at")
        .orderBy("name")
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

usersRouter.post("/", async (req, res) => {
  const { name, username, password, role = "readonly", status = "active" } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: "name, username, password required" });
  }

  const db = getDb();

  try {
    const [id] = await db("users").insert({
      name,
      username,
      password_hash: bcrypt.hashSync(password, 10),
      role,
      status,
    });

    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: "create_user",
      module: "users",
      target: username,
      ip_address: req.ip,
    });

    res.status(201).json({ id, message: "User created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

usersRouter.put("/:id", async (req, res) => {
  const { name, username, password, role, status } = req.body;
  const db = getDb();

  try {
    const upd = {
      name,
      username,
      role,
      status,
      updated_at: new Date().toISOString(),
    };

    if (password) upd.password_hash = bcrypt.hashSync(password, 10);

    await db("users").where({ id: req.params.id }).update(upd);
    res.json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

usersRouter.delete("/:id", async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  try {
    await getDb()("users").where({ id: req.params.id }).delete();
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── auditLogs.js ───────────────────────────────────────────────────────────
// ── auditLogs.js ───────────────────────────────────────────────────────────
const auditRouter = express.Router();
auditRouter.use(authenticate, requireRole("full_access"));

const DEFAULT_AUDIT_LOG_SETTINGS = {
  audit_auto_clear_enabled: "false",
  audit_auto_clear_days: "30",
};

async function getAuditLogSettings(db) {
  const rows = await db("settings")
    .select("key", "value")
    .whereIn("key", Object.keys(DEFAULT_AUDIT_LOG_SETTINGS));

  return {
    ...DEFAULT_AUDIT_LOG_SETTINGS,
    ...Object.fromEntries(rows.map((r) => [r.key, r.value])),
  };
}

async function saveAuditLogSetting(db, key, value) {
  const exists = await db("settings").where({ key }).first();

  if (exists) {
    await db("settings").where({ key }).update({
      value: String(value),
      updated_at: new Date().toISOString(),
    });
  } else {
    await db("settings").insert({
      key,
      value: String(value),
    });
  }
}

function getCutoffDate(days) {
  const safeDays = Math.max(1, Number(days || 30));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - safeDays);
  return cutoff.toISOString();
}

async function cleanupAuditLogs(db, days) {
  const cutoff = getCutoffDate(days);
  return db("audit_logs").where("created_at", "<", cutoff).delete();
}

async function runAuditAutoCleanup(db) {
  const settings = await getAuditLogSettings(db);

  if (String(settings.audit_auto_clear_enabled) !== "true") {
    return 0;
  }

  return cleanupAuditLogs(db, settings.audit_auto_clear_days);
}

auditRouter.get("/", async (req, res) => {
  const { user, module, action, from, to, page = 1, limit = 50 } = req.query;
  const db = getDb();

  try {
    await runAuditAutoCleanup(db);

    let q = db("audit_logs");

    if (user) q = q.where("username", "like", `%${user}%`);
    if (module) q = q.where({ module });
    if (action) q = q.where("action", "like", `%${action}%`);
    if (from) q = q.where("created_at", ">=", from);
    if (to) q = q.where("created_at", "<=", to);

    const total = await q.clone().count("id as c").first();

    const logs = await q
      .orderBy("created_at", "desc")
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    res.json({
      logs,
      total: Number(total.c || 0),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

auditRouter.get("/settings", async (req, res) => {
  const db = getDb();

  try {
    const settings = await getAuditLogSettings(db);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

auditRouter.put("/settings", async (req, res) => {
  const db = getDb();

  try {
    const enabled =
      String(req.body.audit_auto_clear_enabled) === "true" ? "true" : "false";

    const days = Number(req.body.audit_auto_clear_days || 30);

    if (!Number.isFinite(days) || days < 1) {
      return res.status(400).json({ error: "Invalid auto clear days" });
    }

    await saveAuditLogSetting(db, "audit_auto_clear_enabled", enabled);
    await saveAuditLogSetting(db, "audit_auto_clear_days", days);

    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: "update_audit_log_settings",
      module: "audit_logs",
      target: `${enabled === "true" ? "enabled" : "disabled"} / ${days} days`,
      ip_address: req.ip,
    });

    if (enabled === "true") {
      await cleanupAuditLogs(db, days);
    }

    res.json({
      message: "Audit log settings updated",
      settings: {
        audit_auto_clear_enabled: enabled,
        audit_auto_clear_days: String(days),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

auditRouter.post("/cleanup", async (req, res) => {
  const db = getDb();

  try {
    const days = Number(req.body.days || 30);

    if (!Number.isFinite(days) || days < 1) {
      return res.status(400).json({ error: "Invalid cleanup days" });
    }

    const deleted = await cleanupAuditLogs(db, days);

    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: "manual_clear_old_audit_logs",
      module: "audit_logs",
      target: `older than ${days} days`,
      ip_address: req.ip,
      details: JSON.stringify({ deleted }),
    });

    res.json({
      message: "Old audit logs cleared",
      deleted,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
auditRouter.delete("/clear-all", async (req, res) => {
  const db = getDb();

  try {
    const total = await db("audit_logs").count("id as c").first();
    const deleted = Number(total?.c || 0);

    await db("audit_logs").delete();

    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: "clear_all_audit_logs",
      module: "audit_logs",
      target: "all logs",
      ip_address: req.ip,
      details: JSON.stringify({ deleted }),
    });

    res.json({
      message: "All audit logs cleared",
      deleted,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

auditRouter.get("/export", async (req, res) => {
  const db = getDb();

  try {
    await runAuditAutoCleanup(db);

    const logs = await db("audit_logs")
      .orderBy("created_at", "desc")
      .limit(10000);

    const headers = [
      "id",
      "created_at",
      "username",
      "action",
      "module",
      "target",
      "ip_address",
      "status",
      "details",
    ];

    const csv = [
      headers.join(","),
      ...logs.map((l) =>
        headers.map((h) => JSON.stringify(l[h] ?? "")).join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── settings.js ────────────────────────────────────────────────────────────
const settingsRouter = express.Router();
settingsRouter.use(authenticate);

settingsRouter.get("/", async (req, res) => {
  const rows = await getDb()("settings").select("key", "value");
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

settingsRouter.put("/", requireRole("full_access"), async (req, res) => {
  const db = getDb();

  for (const [key, value] of Object.entries(req.body)) {
    const exists = await db("settings").where({ key }).first();

    if (exists) {
      await db("settings")
        .where({ key })
        .update({
          value: String(value),
          updated_at: new Date().toISOString(),
        });
    } else {
      await db("settings").insert({ key, value: String(value) });
    }
  }

  res.json({ message: "Settings updated" });
});

// ── alerts.js ──────────────────────────────────────────────────────────────
const alertsRouter = express.Router();
alertsRouter.use(authenticate);

async function ensureCurrentStatesTable(db) {
  const exists = await db.schema.hasTable("current_states");
  if (exists) return;

  await db.schema.createTable("current_states", (t) => {
    t.increments("id");
    t.string("target_type").notNullable();
    t.integer("target_id").notNullable();
    t.integer("router_id");
    t.string("target_name");
    t.string("state").defaultTo("unknown");
    t.string("severity").defaultTo("info");
    t.string("type");
    t.text("message");
    t.string("state_started_at");
    t.string("last_checked_at");
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
    t.unique(["target_type", "target_id"]);
  });
}

alertsRouter.get("/current", async (req, res) => {
  try {
    const db = getDb();
    await ensureCurrentStatesTable(db);

    const now = Date.now();
    const SOLVED_VISIBLE_MS = 5 * 60 * 1000;

    const rows = await db("current_states")
      .select(
        "id",
        "target_type",
        "target_id",
        "router_id",
        "target_name",
        "state",
        "severity",
        "type",
        "message",
        "state_started_at",
        "last_checked_at",
        "created_at",
        "updated_at"
      )
      .orderBy("state_started_at", "desc")
      .limit(200);

    const result = rows
      .map((r) => {
        const stateTime = new Date(r.state_started_at || r.updated_at || r.created_at || Date.now()).getTime();
        const durationMs = Math.max(0, now - stateTime);
        const state = String(r.state || "").toLowerCase();
        const solved = state === "up";

        return {
          ...r,
          _state_time: stateTime,
          duration_ms: durationMs,
          blink: durationMs <= SOLVED_VISIBLE_MS,
          display_type: solved ? "Resolved" : String(r.type || "—").replace(/_/g, " "),
          display_message: solved ? `${r.target_name || "Target"} is reachable now` : r.message || "—",
        };
      })
      .filter((r) => {
        if (r.state !== "up") return true;
        return r.duration_ms <= SOLVED_VISIBLE_MS;
      })
      .sort((a, b) => b._state_time - a._state_time)
      .slice(0, 50);

    res.json(result);
  } catch (err) {
    console.error("Current alerts error:", err);
    res.status(500).json({ error: err.message });
  }
});

alertsRouter.get("/", async (req, res) => {
  const { status, severity, type, from, to, page = 1, limit = 50 } = req.query;
  const db = getDb();

  try {
    let q = db("alerts");

    if (status) q = q.where({ status });
    if (severity) q = q.where({ severity });
    if (type) q = q.where("type", "like", `%${type}%`);
    if (from) q = q.where("created_at", ">=", from);
    if (to) q = q.where("created_at", "<=", to);

    const total = await q.clone().count("id as c").first();
    const alerts = await q
      .orderBy("created_at", "desc")
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    res.json({ alerts, total: total.c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

alertsRouter.put("/:id/acknowledge", requireRole("full_access", "write"), async (req, res) => {
  await getDb()("alerts")
    .where({ id: req.params.id })
    .update({
      status: "acknowledged",
      updated_at: new Date().toISOString(),
    });

  res.json({ message: "Alert acknowledged" });
});

alertsRouter.put("/:id/resolve", requireRole("full_access", "write"), async (req, res) => {
  await getDb()("alerts")
    .where({ id: req.params.id })
    .update({
      status: "resolved",
      recovery_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  res.json({ message: "Alert resolved" });
});

// ── reports.js ─────────────────────────────────────────────────────────────
const reportsRouter = express.Router();
reportsRouter.use(authenticate);

reportsRouter.get("/destinations", async (req, res) => {
  try {
    const { from, to, group } = req.query;
    const db = getDb();

    let q = db("destinations as d")
      .leftJoin("destination_results as dr", "dr.destination_id", "d.id")
      .select("d.id", "d.name", "d.address", "d.grp")
      .avg("dr.avg_latency as avg_latency")
      .min("dr.min_latency as min_latency")
      .max("dr.max_latency as max_latency")
      .avg("dr.packet_loss as avg_loss")
      .avg("dr.jitter as avg_jitter")
      .count("dr.id as checks")
      .sum({
        online_checks: db.raw("CASE WHEN dr.status = 'online' THEN 1 ELSE 0 END"),
      })
      .groupBy("d.id", "d.name", "d.address", "d.grp")
      .orderBy("d.grp", "asc")
      .orderBy("d.name", "asc");

    if (from) q = q.where("dr.checked_at", ">=", from);
    if (to) q = q.where("dr.checked_at", "<=", to);
    if (group) q = q.where("d.grp", group);

    const rows = await q;

    const result = rows.map((r) => {
      const checks = Number(r.checks || 0);
      const onlineChecks = Number(r.online_checks || 0);

      return {
        ...r,
        checks,
        availability: checks > 0 ? +((onlineChecks / checks) * 100).toFixed(2) : 100,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Destination report error:", err);
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.get("/local-devices", async (req, res) => {
  try {
    const { from, to, type } = req.query;
    const db = getDb();

    let q = db("local_devices as d")
      .leftJoin("local_device_results as r", "r.device_id", "d.id")
      .select("d.id", "d.name", "d.ip", "d.device_type", "d.location", "d.priority")
      .avg("r.avg_latency as avg_latency")
      .avg("r.packet_loss as avg_loss")
      .count("r.id as checks")
      .sum({
        online_checks: db.raw("CASE WHEN r.status = 'online' THEN 1 ELSE 0 END"),
      })
      .groupBy("d.id", "d.name", "d.ip", "d.device_type", "d.location", "d.priority")
      .orderBy("d.device_type", "asc")
      .orderBy("d.name", "asc");

    if (from) q = q.where("r.checked_at", ">=", from);
    if (to) q = q.where("r.checked_at", "<=", to);
    if (type) q = q.where("d.device_type", type);

    const rows = await q;

    const result = rows.map((r) => {
      const checks = Number(r.checks || 0);
      const onlineChecks = Number(r.online_checks || 0);

      return {
        ...r,
        checks,
        availability: checks > 0 ? +((onlineChecks / checks) * 100).toFixed(2) : 100,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Local device report error:", err);
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.get("/uptime", async (req, res) => {
  const rows = await getDb()("local_devices as d")
    .join("local_device_uptime_stats as s", "s.device_id", "d.id")
    .select("d.name", "d.ip", "d.device_type", "d.priority")
    .sum("s.uptime_seconds as total_up")
    .sum("s.downtime_seconds as total_down")
    .sum("s.down_events as events")
    .avg("s.availability as avg_availability")
    .groupBy("d.id")
    .orderBy("avg_availability", "asc");

  res.json(rows);
});

reportsRouter.get("/alerts", async (req, res) => {
  const { from, to } = req.query;
  let q = getDb()("alerts");

  if (from) q = q.where("created_at", ">=", from);
  if (to) q = q.where("created_at", "<=", to);

  res.json(await q.orderBy("created_at", "desc"));
});

// ── bulk.js ────────────────────────────────────────────────────────────────
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const bulkRouter = express.Router();
bulkRouter.use(authenticate, requireRole("full_access", "write"));

function parseCSV(buffer) {
  return parse(buffer.toString("utf-8").replace(/^\uFEFF/, ""), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

bulkRouter.post("/routers/preview", upload.single("file"), async (req, res) => {
  try {
    const rows = parseCSV(req.file.buffer);
    const db = getDb();

    const preview = await Promise.all(
      rows.map(async (r) => {
        const errors = [];

        if (!r.name) errors.push("name required");
        if (!r.host) errors.push("host required");
        if (!r.username) errors.push("username required");

        const exists = await db("routers").where("name", r.name).orWhere("host", r.host).first();
        if (exists) errors.push("duplicate");

        const pingSourceMode = (r.pingSourceMode || r.ping_source_mode || "none").toLowerCase();

        if (!["none", "address", "interface"].includes(pingSourceMode)) {
          errors.push("pingSourceMode must be none, address, or interface");
        }

        if (pingSourceMode === "address" && !(r.pingSourceAddress || r.ping_src_address)) {
          errors.push("pingSourceAddress required when pingSourceMode is address");
        }

        if (pingSourceMode === "interface" && !(r.pingSourceInterface || r.ping_src_interface)) {
          errors.push("pingSourceInterface required when pingSourceMode is interface");
        }

        return {
          ...r,
          _errors: errors,
          _valid: errors.length === 0,
        };
      })
    );

    res.json({
      rows: preview,
      total: rows.length,
      valid: preview.filter((r) => r._valid).length,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

bulkRouter.post("/routers/import", upload.single("file"), async (req, res) => {
  const rows = parseCSV(req.file.buffer);
  const db = getDb();
  let imported = 0;
  const errors = [];

  for (const r of rows) {
    try {
      const pingSourceMode = (r.pingSourceMode || r.ping_source_mode || "none").toLowerCase();

      const pingSrcAddress =
        pingSourceMode === "address" ? r.pingSourceAddress || r.ping_src_address || "" : "";

      const pingSrcInterface =
        pingSourceMode === "interface" ? r.pingSourceInterface || r.ping_src_interface || "" : "";

      await db("routers").insert({
        name: r.name,
        host: r.host,
        api_username: r.username,
        api_password: r.password || "admin",
        api_port: r.apiPort || r.api_port || 8728,
        api_ssl: r.ssl === "true" || r.api_ssl === "true" ? 1 : 0,
        location: r.location || null,
        description: r.description || null,
        enabled: r.enabled !== "false" ? 1 : 0,
        ping_src_address: pingSrcAddress,
        ping_src_interface: pingSrcInterface,
      });

      imported++;
    } catch (e) {
      errors.push({ row: r.name, error: e.message });
    }
  }

  res.json({ imported, errors });
});

bulkRouter.post("/destinations/preview", upload.single("file"), async (req, res) => {
  try {
    const rows = parseCSV(req.file.buffer);
    const db = getDb();

    const preview = await Promise.all(
      rows.map(async (r) => {
        const errors = [];

        if (!r.name) errors.push("name required");
        if (!r.address) errors.push("address required");

        const exists = await db("destinations").where({ name: r.name }).first();
        if (exists) errors.push("duplicate");

        return {
          ...r,
          _errors: errors,
          _valid: errors.length === 0,
        };
      })
    );

    res.json({
      rows: preview,
      total: rows.length,
      valid: preview.filter((r) => r._valid).length,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

bulkRouter.post("/destinations/import", upload.single("file"), async (req, res) => {
  const rows = parseCSV(req.file.buffer);
  const db = getDb();
  let imported = 0;
  const errors = [];

  for (const r of rows) {
    try {
      await db("destinations").insert({
        name: r.name,
        address: r.address,
        grp: r.group || "Other",
        description: r.description || null,
        warn_latency: r.warningLatency || 50,
        crit_latency: r.criticalLatency || 150,
        warn_loss: r.warningLoss || 10,
        crit_loss: r.criticalLoss || 50,
        enabled: r.enabled !== "false" ? 1 : 0,
      });

      imported++;
    } catch (e) {
      errors.push({ row: r.name, error: e.message });
    }
  }

  res.json({ imported, errors });
});

bulkRouter.post("/local-devices/preview", upload.single("file"), async (req, res) => {
  try {
    const rows = parseCSV(req.file.buffer);
    const db = getDb();

    const preview = await Promise.all(
      rows.map(async (r) => {
        const errors = [];

        if (!r.name) errors.push("name required");
        if (!r.ip) errors.push("ip required");

        const router = r.routerName ? await db("routers").where({ name: r.routerName }).first() : null;

        if (r.routerName && !router) {
          errors.push(`router '${r.routerName}' not found`);
        }

        return {
          ...r,
          _errors: errors,
          _valid: errors.length === 0,
          _router_id: router?.id,
        };
      })
    );

    res.json({
      rows: preview,
      total: rows.length,
      valid: preview.filter((r) => r._valid).length,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

bulkRouter.post("/local-devices/import", upload.single("file"), async (req, res) => {
  const rows = parseCSV(req.file.buffer);
  const db = getDb();
  let imported = 0;
  const errors = [];

  for (const r of rows) {
    try {
      const router = r.routerName ? await db("routers").where({ name: r.routerName }).first() : null;

      await db("local_devices").insert({
        name: r.name,
        ip: r.ip,
        device_type: r.type || "Other",
        location: r.location || null,
        router_id: router?.id || null,
        priority: r.priority || "medium",
        description: r.description || null,
        enabled: r.enabled !== "false" ? 1 : 0,
      });

      imported++;
    } catch (e) {
      errors.push({ row: r.name, error: e.message });
    }
  }

  res.json({ imported, errors });
});

module.exports = {
  usersRouter,
  auditRouter,
  settingsRouter,
  alertsRouter,
  reportsRouter,
  bulkRouter,
};