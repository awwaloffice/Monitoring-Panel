const knex = require("knex");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../data/monitoring.db");

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = knex({
      client: "sqlite3",
      connection: { filename: DB_PATH },
      useNullAsDefault: true,
      pool: {
  min: 1,
  max: Number(process.env.SQLITE_POOL_MAX || 4),
  afterCreate: (conn, cb) => {
    conn.serialize(() => {
      conn.run("PRAGMA journal_mode = WAL;");
      conn.run("PRAGMA synchronous = NORMAL;");
      conn.run("PRAGMA foreign_keys = ON;");
      conn.run("PRAGMA busy_timeout = 5000;");
      conn.run("PRAGMA temp_store = MEMORY;");
      conn.run("PRAGMA cache_size = -20000;");
      conn.run("PRAGMA wal_autocheckpoint = 1000;", cb);
    });
  },
},
    });
  }
  return db;
}

async function createTableIfNotExists(db, name, builder) {
  const exists = await db.schema.hasTable(name);
  if (!exists) await db.schema.createTable(name, builder);
}

async function addColumnIfMissing(db, tableName, columnName, addColumn) {
  const columns = await db(tableName).columnInfo();
  if (!columns[columnName]) {
    await db.schema.alterTable(tableName, (t) => {
      addColumn(t);
    });
  }
}
async function createPerformanceIndexes(db) {
  const indexes = [
    // Destination latest/history queries
    "CREATE INDEX IF NOT EXISTS idx_destination_results_dest_router_checked ON destination_results(destination_id, router_id, checked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_destination_results_dest_checked ON destination_results(destination_id, checked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_destination_results_router_checked ON destination_results(router_id, checked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_destination_results_status_checked ON destination_results(status, checked_at DESC)",

    // Local device latest/history queries
    "CREATE INDEX IF NOT EXISTS idx_local_device_results_device_checked ON local_device_results(device_id, checked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_local_device_results_device_status_checked ON local_device_results(device_id, status, checked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_local_device_results_router_checked ON local_device_results(router_id, checked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_local_device_results_status_checked ON local_device_results(status, checked_at DESC)",

    // Current state / alert queries
    "CREATE INDEX IF NOT EXISTS idx_current_states_type_target_router ON current_states(target_type, target_id, router_id)",
    "CREATE INDEX IF NOT EXISTS idx_current_states_state_updated ON current_states(state, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON alerts(status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_alerts_target_status ON alerts(target_type, target_id, status)",

    // Audit/system/settings/report queries
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_module_created ON audit_logs(module, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_local_device_uptime_device_date ON local_device_uptime_stats(device_id, date DESC)",

    // Common filter/search helper indexes
    "CREATE INDEX IF NOT EXISTS idx_routers_enabled_location ON routers(enabled, location)",
    "CREATE INDEX IF NOT EXISTS idx_destinations_enabled_group ON destinations(enabled, grp)",
    "CREATE INDEX IF NOT EXISTS idx_local_devices_enabled_type_router ON local_devices(enabled, device_type, router_id)",
  ];

  for (const sql of indexes) {
    await db.raw(sql);
  }

  logger.info("Performance indexes checked/created successfully.");
}

async function initDb() {
  const db = getDb();
  logger.info("Initializing database...");

  await createTableIfNotExists(db, "users", (t) => {
    t.increments("id");
    t.string("name").notNullable();
    t.string("username").unique().notNullable();
    t.string("password_hash").notNullable();
    t.string("role").defaultTo("readonly");
    t.string("status").defaultTo("active");
    t.string("last_login");
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "routers", (t) => {
    t.increments("id");
    t.string("name").notNullable();
    t.string("host").notNullable();
    t.string("api_username").notNullable();
    t.string("api_password").notNullable();
    t.integer("api_port").defaultTo(8728);
    t.integer("api_ssl").defaultTo(0);
    t.string("location");
    t.string("description");
    t.integer("enabled").defaultTo(1);
    t.string("ping_src_address");
    t.string("ping_src_interface");
    t.string("connection_status").defaultTo("unknown");
    t.string("ros_version");
    t.string("uptime");
    t.string("last_seen");
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "destinations", (t) => {
    t.increments("id");
    t.string("name").notNullable();
    t.string("address").notNullable();
    t.string("grp").defaultTo("Other");
    t.string("description");
    t.integer("enabled").defaultTo(1);
    t.integer("warn_latency").defaultTo(50);
    t.integer("crit_latency").defaultTo(150);
    t.integer("warn_loss").defaultTo(10);
    t.integer("crit_loss").defaultTo(50);
    t.integer("check_interval").defaultTo(60);
    t.integer("packet_count").defaultTo(5);
    t.integer("timeout").defaultTo(3000);
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "destination_results", (t) => {
    t.increments("id");
    t.integer("router_id").notNullable();
    t.integer("destination_id").notNullable();
    t.float("min_latency");
    t.float("avg_latency");
    t.float("max_latency");
    t.float("packet_loss");
    t.float("jitter");
    t.string("status").defaultTo("unknown");
    t.timestamp("checked_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "local_devices", (t) => {
    t.increments("id");
    t.string("name").notNullable();
    t.string("ip").notNullable();
    t.string("device_type").defaultTo("Other");
    t.string("location");
    t.integer("router_id");
    t.string("description");
    t.integer("enabled").defaultTo(1);
    t.string("priority").defaultTo("medium");
    t.integer("warn_latency").defaultTo(10);
    t.integer("crit_latency").defaultTo(50);
    t.integer("loss_threshold").defaultTo(20);
    t.integer("check_interval").defaultTo(30);
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "local_device_results", (t) => {
    t.increments("id");
    t.integer("device_id").notNullable();
    t.integer("router_id");
    t.float("min_latency");
    t.float("avg_latency");
    t.float("max_latency");
    t.float("packet_loss");
    t.float("jitter");
    t.string("status").defaultTo("unknown");
    t.timestamp("checked_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "local_device_uptime_stats", (t) => {
    t.increments("id");
    t.integer("device_id").notNullable();
    t.string("date").notNullable();
    t.integer("uptime_seconds").defaultTo(0);
    t.integer("downtime_seconds").defaultTo(0);
    t.integer("down_events").defaultTo(0);
    t.float("availability").defaultTo(100);
    t.unique(["device_id", "date"]);
  });

  await createTableIfNotExists(db, "alerts", (t) => {
    t.increments("id");
    t.string("type").notNullable();
    t.string("severity").defaultTo("warning");
    t.integer("router_id");
    t.string("target_type");
    t.integer("target_id");
    t.string("target_name");
    t.text("message").notNullable();
    t.string("status").defaultTo("open");
    t.string("recovery_time");
    t.string("state_started_at");
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await addColumnIfMissing(db, "alerts", "state_started_at", (t) => t.string("state_started_at"));
  await addColumnIfMissing(db, "routers", "ping_src_address", (t) => t.string("ping_src_address"));
  await addColumnIfMissing(db, "routers", "ping_src_interface", (t) => t.string("ping_src_interface"));

  await createTableIfNotExists(db, "current_states", (t) => {
    t.increments("id");
    t.string("target_type").notNullable();
    t.integer("target_id").notNullable();
    t.string("target_name");
    t.integer("router_id");
    t.string("state").defaultTo("up");
    t.string("severity").defaultTo("info");
    t.string("type");
    t.text("message");
    t.string("state_started_at");
    t.string("last_checked_at");
    t.timestamp("created_at").defaultTo(db.fn.now());
    t.timestamp("updated_at").defaultTo(db.fn.now());
    t.unique(["target_type", "target_id"]);
  });

  await createTableIfNotExists(db, "audit_logs", (t) => {
    t.increments("id");
    t.integer("user_id");
    t.string("username");
    t.string("action").notNullable();
    t.string("module").notNullable();
    t.string("target");
    t.string("ip_address");
    t.text("details");
    t.string("status").defaultTo("success");
    t.timestamp("created_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "settings", (t) => {
    t.string("key").primary();
    t.text("value").notNullable();
    t.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await createTableIfNotExists(db, "system_logs", (t) => {
    t.increments("id");
    t.string("level").notNullable();
    t.text("message").notNullable();
    t.text("context");
    t.timestamp("created_at").defaultTo(db.fn.now());
  });

  // Seed settings
  await createPerformanceIndexes(db);
    const defaults = [
    ["app_name", "Monitoring Panel"],
    ["check_interval", "60"],
    ["ping_packet_count", "5"],
    ["ping_timeout", "3000"],
    ["retry_count", "2"],
    ["auto_refresh_interval", "30"],
    ["warn_latency", "50"],
    ["crit_latency", "150"],
    ["warn_loss", "10"],
    ["crit_loss", "50"],
    ["flap_threshold", "5"],
    ["flap_window", "300"],
    ["session_timeout", "3600"],

    // Performance cleanup settings
    ["cleanup_enabled", "true"],
    ["cleanup_destination_results_days", "7"],
    ["cleanup_local_device_results_days", "7"],
    ["cleanup_local_device_uptime_days", "90"],
    ["cleanup_resolved_alerts_days", "30"],
    ["cleanup_system_logs_days", "15"],
    ["cleanup_audit_logs_days", "90"],
  ];
  for (const [key, value] of defaults) {
    const exists = await db("settings").where({ key }).first();
    if (!exists) await db("settings").insert({ key, value });
  }

  // Seed admin
  const adminExists = await db("users").where({ username: "admin" }).first();
  if (!adminExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    await db("users").insert({ name: "Administrator", username: "admin", password_hash: hash, role: "full_access" });
    logger.info("Default admin user created: admin / admin123");
  }

  if (process.env.SEED_SAMPLE_DATA === "true") {
    await seedSampleData(db);
  }
  logger.info("Database initialized successfully.");
}

async function seedSampleData(db) {
  const count = await db("routers").count("id as c").first();
  if (count.c > 0) return;
  logger.info("Seeding sample data...");

  await db("routers").insert([
    { name: "Core-Router-01", host: "192.168.1.1", api_username: "api_user", api_password: "api_pass", api_port: 8728, location: "HQ-POP", connection_status: "connected", ros_version: "7.13", uptime: "45d 12h" },
    { name: "Edge-Router-02", host: "10.0.0.1", api_username: "api_user", api_password: "api_pass", api_port: 8728, location: "POP-North", connection_status: "connected", ros_version: "7.12", uptime: "20d 5h" },
    { name: "Edge-Router-03", host: "10.0.1.1", api_username: "api_user", api_password: "api_pass", api_port: 8729, api_ssl: 1, location: "POP-South", connection_status: "connected", ros_version: "7.13.2", uptime: "10d 2h" },
    { name: "Backup-Router-04", host: "172.16.0.1", api_username: "api_user", api_password: "api_pass", api_port: 8728, location: "HQ-POP", connection_status: "disconnected", ros_version: "7.11", uptime: "0d" },
  ]);

  await db("destinations").insert([
    { name: "Google GGC",    address: "8.8.8.8",        grp: "GGC",   warn_latency: 30, crit_latency: 100 },
    { name: "YouTube CDN",   address: "googlevideo.com", grp: "GGC",   warn_latency: 40, crit_latency: 120 },
    { name: "Facebook CDN",  address: "31.13.72.36",     grp: "CDN",   warn_latency: 40, crit_latency: 120 },
    { name: "Cloudflare CDN",address: "1.1.1.1",         grp: "CDN",   warn_latency: 20, crit_latency: 80  },
    { name: "Akamai CDN",    address: "23.192.0.1",      grp: "CDN",   warn_latency: 35, crit_latency: 100 },
    { name: "AWS FNA",       address: "52.94.0.0",       grp: "FNA",   warn_latency: 25, crit_latency: 90  },
    { name: "Steam Games",   address: "185.25.182.1",    grp: "Games", warn_latency: 50, crit_latency: 150 },
    { name: "Garena Games",  address: "43.252.80.1",     grp: "Games", warn_latency: 45, crit_latency: 130 },
    { name: "Google DNS",    address: "8.8.4.4",         grp: "DNS",   warn_latency: 15, crit_latency: 50  },
    { name: "Cloudflare DNS",address: "1.0.0.1",         grp: "DNS",   warn_latency: 15, crit_latency: 50  },
    { name: "BDIX IX",       address: "103.4.96.1",      grp: "IX",    warn_latency: 5,  crit_latency: 20  },
    { name: "NOOR IX",       address: "103.24.0.1",      grp: "IX",    warn_latency: 5,  crit_latency: 20  },
    { name: "Twitch Stream", address: "52.223.241.1",    grp: "CDN",   warn_latency: 60, crit_latency: 180 },
    { name: "Netflix OCA",   address: "45.57.0.1",       grp: "FNA",   warn_latency: 30, crit_latency: 100 },
    { name: "WhatsApp",      address: "157.240.0.1",     grp: "Other", warn_latency: 40, crit_latency: 120 },
  ]);

  await db("local_devices").insert([
    { name: "ONU-001",        ip: "192.168.10.1",  device_type: "ONU",     location: "POP-North", router_id: 1, priority: "medium"   },
    { name: "ONU-002",        ip: "192.168.10.2",  device_type: "ONU",     location: "POP-North", router_id: 1, priority: "medium"   },
    { name: "Core-Switch-01", ip: "10.10.0.2",     device_type: "Switch",  location: "HQ-POP",    router_id: 1, priority: "critical" },
    { name: "Access-Switch-02",ip:"10.10.0.3",     device_type: "Switch",  location: "POP-North", router_id: 2, priority: "high"     },
    { name: "OLT-Main",       ip: "10.20.0.1",     device_type: "OLT",     location: "HQ-POP",    router_id: 1, priority: "critical" },
    { name: "AP-Roof-01",     ip: "192.168.50.1",  device_type: "AP",      location: "Rooftop",   router_id: 1, priority: "medium"   },
    { name: "AP-Floor-02",    ip: "192.168.50.2",  device_type: "AP",      location: "POP-North", router_id: 2, priority: "medium"   },
    { name: "CCTV-NVR-01",   ip: "192.168.100.1", device_type: "CCTV",    location: "HQ-POP",    router_id: 1, priority: "low"      },
    { name: "File-Server-01", ip: "10.30.0.1",     device_type: "Server",  location: "HQ-POP",    router_id: 1, priority: "high"     },
    { name: "NAS-01",         ip: "10.30.0.2",     device_type: "NAS",     location: "HQ-POP",    router_id: 1, priority: "high"     },
    { name: "GW-ISP1",        ip: "203.0.113.1",   device_type: "Gateway", location: "HQ-POP",    router_id: 1, priority: "critical" },
    { name: "GW-ISP2",        ip: "198.51.100.1",  device_type: "Gateway", location: "HQ-POP",    router_id: 2, priority: "critical" },
    { name: "Printer-HP",     ip: "192.168.200.1", device_type: "Printer", location: "HQ-POP",    router_id: 1, priority: "low"      },
    { name: "OLT-Branch",     ip: "10.20.0.2",     device_type: "OLT",     location: "POP-South", router_id: 3, priority: "high"     },
    { name: "AP-South-01",    ip: "192.168.51.1",  device_type: "AP",      location: "POP-South", router_id: 3, priority: "medium"   },
  ]);

  // Seed results in chunks
  const now = new Date();
  const destResults = [];
  for (let destId = 1; destId <= 15; destId++) {
    for (let routerId = 1; routerId <= 3; routerId++) {
      for (let i = 0; i < 30; i++) {
        const ts = new Date(now.getTime() - i * 60000).toISOString().replace("T"," ").slice(0,19);
        const base = 10 + Math.random() * 80;
        const loss = Math.random() < 0.05 ? Math.random() * 30 : 0;
        destResults.push({ router_id: routerId, destination_id: destId,
          min_latency: +(base*0.8).toFixed(2), avg_latency: +base.toFixed(2),
          max_latency: +(base*1.3).toFixed(2), packet_loss: +loss.toFixed(2),
          jitter: +(Math.random()*10).toFixed(2),
          status: loss>50?"down":loss>10?"warning":"online", checked_at: ts });
      }
    }
  }
  for (let i = 0; i < destResults.length; i += 200)
    await db("destination_results").insert(destResults.slice(i, i+200));

  const devResults = [];
  for (let devId = 1; devId <= 15; devId++) {
    for (let i = 0; i < 30; i++) {
      const ts = new Date(now.getTime() - i * 30000).toISOString().replace("T"," ").slice(0,19);
      const down = devId === 4 && i < 5;
      const loss = down ? 100 : Math.random() < 0.03 ? 20 : 0;
      const base = 1 + Math.random() * 8;
      devResults.push({ device_id: devId, router_id: 1,
        min_latency: +(base*0.7).toFixed(2), avg_latency: +base.toFixed(2),
        max_latency: +(base*1.5).toFixed(2), packet_loss: +loss.toFixed(2),
        jitter: +(Math.random()*2).toFixed(2),
        status: down?"down":loss>20?"warning":"online", checked_at: ts });
    }
  }
  for (let i = 0; i < devResults.length; i += 200)
    await db("local_device_results").insert(devResults.slice(i, i+200));

  await db("alerts").insert([
    { type:"destination_down", severity:"critical", router_id:1, target_type:"destination", target_id:7, target_name:"Steam Games", message:"Steam Games is DOWN from Core-Router-01 (100% packet loss)", status:"open" },
    { type:"high_latency", severity:"warning", router_id:2, target_type:"destination", target_id:8, target_name:"Garena Games", message:"High latency: 145ms avg from Edge-Router-02", status:"open" },
    { type:"device_down", severity:"critical", router_id:1, target_type:"local_device", target_id:4, target_name:"Access-Switch-02", message:"Access-Switch-02 is unreachable (100% packet loss)", status:"open" },
    { type:"device_recovery", severity:"info", router_id:1, target_type:"local_device", target_id:13, target_name:"Printer-HP", message:"Printer-HP has recovered", status:"resolved", recovery_time: new Date().toISOString() },
    { type:"flapping", severity:"warning", router_id:2, target_type:"local_device", target_id:7, target_name:"AP-Floor-02", message:"AP-Floor-02 is flapping (5 state changes in 10 min)", status:"open" },
  ]);

  logger.info("Sample data seeded.");
}

module.exports = { getDb, initDb };
