const cron = require("node-cron");
const { getDb } = require("../db/migrate");
const { getClient, pingFromRouter, pingWithClient } = require("./mikrotik");
const logger = require("../utils/logger");

let isRunning = false;
const ROUTER_CONCURRENCY = Number(process.env.MONITOR_ROUTER_CONCURRENCY || 3);

async function runWithConcurrency(items, limit, worker) {
  const safeLimit = Math.max(1, Number(limit || 1));
  const queue = [...items];

  const workers = Array.from({ length: Math.min(safeLimit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });

  await Promise.all(workers);
}

function startMonitoringEngine() {
  logger.info("Monitoring engine started.");

  setTimeout(async () => {
    await runMonitoringCycle();
  }, 1000);

  cron.schedule("*/10 * * * * *", async () => {
    await runMonitoringCycle();
  });

  cron.schedule("*/5 * * * *", async () => {
    try {
      await aggregateUptimeStats();
    } catch (err) {
      logger.error("Uptime agg error: " + err.message);
    }
  });

  cron.schedule("0 2 * * *", async () => {
    await cleanupOldResults();
  });

    setTimeout(async () => {
    try {
      await cleanupOldResults();
    } catch (err) {
      logger.error("Startup cleanup error: " + err.message);
    }
  }, 20000);
}

async function runMonitoringCycle() {
  if (isRunning) return;
  isRunning = true;

  try {
    const db = getDb();
    await ensureCurrentStatesTable(db);
    await runDestinationCheck();
    await runLocalDeviceCheck();
  } catch (err) {
    logger.error("Monitoring cycle error: " + err.message);
  } finally {
    isRunning = false;
  }
}

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

  logger.info("current_states table created.");
}

async function updateCurrentState(db, payload) {
  await ensureCurrentStatesTable(db);

  const now = new Date().toISOString();
  const existing = await db("current_states")
    .where({
      target_type: payload.target_type,
      target_id: payload.target_id,
    })
    .first();

  if (!existing) {
    await db("current_states").insert({
      target_type: payload.target_type,
      target_id: payload.target_id,
      router_id: payload.router_id || null,
      target_name: payload.target_name || "Unknown",
      state: payload.state,
      severity: payload.severity,
      type: payload.type,
      message: payload.message,
      state_started_at: now,
      last_checked_at: now,
      created_at: now,
      updated_at: now,
    });
    return;
  }

  const stateChanged = String(existing.state || "") !== String(payload.state || "");

  await db("current_states")
    .where({ id: existing.id })
    .update({
      router_id: payload.router_id || existing.router_id || null,
      target_name: payload.target_name || existing.target_name,
      state: payload.state,
      severity: payload.severity,
      type: payload.type,
      message: payload.message,
      state_started_at: stateChanged ? now : existing.state_started_at || now,
      last_checked_at: now,
      updated_at: now,
    });
}

async function runDestinationCheck() {
  const db = getDb();
  const routers = await db("routers").where({
    enabled: 1,
    connection_status: "connected",
  });
  const destinations = await db("destinations").where({ enabled: 1 });

  if (!routers.length || !destinations.length) return;

  await runWithConcurrency(routers, ROUTER_CONCURRENCY, async (router) => {
    const client = await getClient(router);

    if (!client) {
      for (const dest of destinations) {
        await checkDestination(db, router, dest, null, {
          success: false,
          target: dest.address,
          avg_latency: null,
          min_latency: null,
          max_latency: null,
          packet_loss: 100,
          jitter: null,
          error: "RouterOS API connection failed",
        });
      }
      return;
    }

    try {
      for (const dest of destinations) {
        await checkDestination(db, router, dest, client);
      }
    } finally {
      try {
        client.close();
      } catch (_) {}
    }
  });
}

async function checkDestination(db, router, dest, client = null, forcedResult = null) {
  try {
    const result =
      forcedResult ||
      (client
        ? await pingWithClient(client, router, dest.address, dest.packet_count || 5)
        : await pingFromRouter(router, dest.address, dest.packet_count || 5, dest.timeout || 3000));

    const status = calcDestStatus(result, dest);

    const prev = await db("destination_results")
      .where({ router_id: router.id, destination_id: dest.id })
      .orderBy("checked_at", "desc")
      .first();

    await db("destination_results").insert({
      router_id: router.id,
      destination_id: dest.id,
      min_latency: result.min_latency,
      avg_latency: result.avg_latency,
      max_latency: result.max_latency,
      packet_loss: result.packet_loss,
      jitter: result.jitter,
      status,
    });

    const statePayload = buildDestinationStatePayload(router, dest, status, result);
    await updateCurrentState(db, statePayload);

    if (prev && prev.status !== status) {
      if (status === "down") {
        await createAlert(
          db,
          "destination_down",
          "critical",
          router.id,
          "destination",
          dest.id,
          dest.name,
          `${dest.name} is DOWN from ${router.name} (${result.packet_loss}% packet loss)`
        );
      } else if (status === "online" && prev.status === "down") {
        await resolveAlerts(db, "destination", dest.id);
        await createAlert(
          db,
          "destination_recovery",
          "info",
          router.id,
          "destination",
          dest.id,
          dest.name,
          `${dest.name} recovered on ${router.name}`
        );
      } else if (status === "warning") {
        await createAlert(
          db,
          "high_latency",
          "warning",
          router.id,
          "destination",
          dest.id,
          dest.name,
          `${dest.name}: high latency ${result.avg_latency}ms / ${result.packet_loss}% loss from ${router.name}`
        );
      }
    }
  } catch (err) {
    logger.warn(`Dest check failed ${dest.name} via ${router.name}: ${err.message}`);
  }
}

function buildDestinationStatePayload(router, dest, status, result) {
  if (status === "online") {
    return {
      target_type: "destination",
      target_id: dest.id,
      router_id: router.id,
      target_name: dest.name,
      state: "up",
      severity: "info",
      type: "resolved",
      message: `${dest.name} is reachable now from ${router.name}`,
    };
  }

  if (status === "warning") {
    return {
      target_type: "destination",
      target_id: dest.id,
      router_id: router.id,
      target_name: dest.name,
      state: "warning",
      severity: "warning",
      type: "high_latency",
      message: `${dest.name} has warning status from ${router.name}`,
    };
  }

  return {
    target_type: "destination",
    target_id: dest.id,
    router_id: router.id,
    target_name: dest.name,
    state: "down",
    severity: "critical",
    type: "destination_down",
    message: `${dest.name} is DOWN from ${router.name} (${result.packet_loss}% packet loss)`,
  };
}

async function runLocalDeviceCheck() {
  const db = getDb();
  const devices = await db("local_devices as d")
    .join("routers as r", "r.id", "d.router_id")
    .where("d.enabled", 1)
    .where("r.enabled", 1)
    .select(
      "d.*",
      "r.id as r_id",
      "r.name as r_name",
      "r.host",
      "r.api_username",
      "r.api_password",
      "r.api_port",
      "r.api_ssl",
      "r.connection_status",
      "r.ping_src_address",
      "r.ping_src_interface"
    );

  if (!devices.length) return;

  const grouped = new Map();

  for (const dev of devices) {
    const key = String(dev.r_id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        router: {
          id: dev.r_id,
          name: dev.r_name,
          host: dev.host,
          api_username: dev.api_username,
          api_password: dev.api_password,
          api_port: dev.api_port,
          api_ssl: dev.api_ssl,
          ping_src_address: dev.ping_src_address,
          ping_src_interface: dev.ping_src_interface,
        },
        devices: [],
      });
    }

    grouped.get(key).devices.push(dev);
  }

  const routerGroups = Array.from(grouped.values());

  await runWithConcurrency(routerGroups, ROUTER_CONCURRENCY, async (group) => {
    const client = await getClient(group.router);

    if (!client) {
      for (const dev of group.devices) {
        await checkLocalDevice(db, dev, null, {
          success: false,
          target: dev.ip,
          avg_latency: null,
          min_latency: null,
          max_latency: null,
          packet_loss: 100,
          jitter: null,
          error: "RouterOS API connection failed",
        });
      }
      return;
    }

    try {
      for (const dev of group.devices) {
        await checkLocalDevice(db, dev, client);
      }
    } finally {
      try {
        client.close();
      } catch (_) {}
    }
  });
}

async function checkLocalDevice(db, dev, client = null, forcedResult = null) {
  try {
    const router = {
      id: dev.r_id,
      name: dev.r_name,
      host: dev.host,
      api_username: dev.api_username,
      api_password: dev.api_password,
      api_port: dev.api_port,
      api_ssl: dev.api_ssl,
      ping_src_address: dev.ping_src_address,
      ping_src_interface: dev.ping_src_interface,
    };

    const result =
  forcedResult ||
  (client
    ? await pingWithClient(client, router, dev.ip, 5)
    : await pingFromRouter(router, dev.ip, 5, 3000));
    const status = calcDeviceStatus(result, dev);

    const prev = await db("local_device_results")
      .where({ device_id: dev.id })
      .orderBy("checked_at", "desc")
      .first();

    await db("local_device_results").insert({
      device_id: dev.id,
      router_id: dev.r_id,
      min_latency: result.min_latency,
      avg_latency: result.avg_latency,
      max_latency: result.max_latency,
      packet_loss: result.packet_loss,
      jitter: result.jitter,
      status,
    });

    const statePayload = buildDeviceStatePayload(dev, status, result);
    await updateCurrentState(db, statePayload);

    const since = new Date(Date.now() - 600000).toISOString().replace("T", " ").slice(0, 19);
    const recent = await db("local_device_results")
      .where("device_id", dev.id)
      .where("checked_at", ">=", since)
      .orderBy("checked_at", "asc")
      .select("status");

    let changes = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].status !== recent[i - 1].status) changes++;
    }

    if (changes >= 3) {
      await createAlert(
        db,
        "flapping",
        "warning",
        dev.r_id,
        "local_device",
        dev.id,
        dev.name,
        `${dev.name} is flapping (${changes} state changes in last 10 min)`
      );
    }

    if (prev && prev.status !== status) {
      if (status === "down") {
        const severity = dev.priority === "critical" ? "critical" : "warning";
        await createAlert(
          db,
          "device_down",
          severity,
          dev.r_id,
          "local_device",
          dev.id,
          dev.name,
          `${dev.name} (${dev.device_type}) is unreachable`
        );
      } else if (status === "online" && prev.status === "down") {
        await resolveAlerts(db, "local_device", dev.id);
        await createAlert(
          db,
          "device_recovery",
          "info",
          dev.r_id,
          "local_device",
          dev.id,
          dev.name,
          `${dev.name} has recovered`
        );
      }
    }
  } catch (err) {
    logger.warn(`Device check failed ${dev.name}: ${err.message}`);
  }
}

function buildDeviceStatePayload(dev, status, result) {
  if (status === "online") {
    return {
      target_type: "local_device",
      target_id: dev.id,
      router_id: dev.r_id,
      target_name: dev.name,
      state: "up",
      severity: "info",
      type: "resolved",
      message: `${dev.name} is reachable now`,
    };
  }

  if (status === "warning") {
    return {
      target_type: "local_device",
      target_id: dev.id,
      router_id: dev.r_id,
      target_name: dev.name,
      state: "warning",
      severity: "warning",
      type: "device_warning",
      message: `${dev.name} has warning status`,
    };
  }

  return {
    target_type: "local_device",
    target_id: dev.id,
    router_id: dev.r_id,
    target_name: dev.name,
    state: "down",
    severity: dev.priority === "critical" ? "critical" : "warning",
    type: "device_down",
    message: `${dev.name} (${dev.device_type}) is unreachable`,
  };
}

async function aggregateUptimeStats() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today} 00:00:00`;
  const dayEnd = `${today} 23:59:59`;
  const devices = await db("local_devices").where({ enabled: 1 }).select("id");

  for (const dev of devices) {
    const results = await db("local_device_results")
      .where("device_id", dev.id)
      .whereBetween("checked_at", [dayStart, dayEnd])
      .orderBy("checked_at", "asc")
      .select("status", "checked_at");

    let uptime = 0;
    let downtime = 0;
    let downEvents = 0;

    for (let i = 1; i < results.length; i++) {
      const dur = (new Date(results[i].checked_at) - new Date(results[i - 1].checked_at)) / 1000;

      if (results[i - 1].status === "online") uptime += dur;
      else downtime += dur;

      if (results[i].status === "down" && results[i - 1].status !== "down") {
        downEvents++;
      }
    }

    const total = uptime + downtime;
    const availability = total > 0 ? +((uptime / total) * 100).toFixed(4) : 100;

    const exists = await db("local_device_uptime_stats")
      .where({ device_id: dev.id, date: today })
      .first();

    if (exists) {
      await db("local_device_uptime_stats")
        .where({ device_id: dev.id, date: today })
        .update({
          uptime_seconds: Math.round(uptime),
          downtime_seconds: Math.round(downtime),
          down_events: downEvents,
          availability,
        });
    } else {
      await db("local_device_uptime_stats").insert({
        device_id: dev.id,
        date: today,
        uptime_seconds: Math.round(uptime),
        downtime_seconds: Math.round(downtime),
        down_events: downEvents,
        availability,
      });
    }
  }
}

async function getSetting(db, key, fallback) {
  const row = await db("settings").where({ key }).first();
  return row ? row.value : fallback;
}

function dateCutoff(days) {
  const safeDays = Math.max(1, Number(days || 1));
  return new Date(Date.now() - safeDays * 86400000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

async function cleanupOldResults() {
  const db = getDb();

  const enabled = await getSetting(db, "cleanup_enabled", "true");

  if (String(enabled) !== "true") {
    logger.info("Auto cleanup skipped because cleanup_enabled=false.");
    return;
  }

  const destinationDays = await getSetting(db, "cleanup_destination_results_days", "7");
  const localDeviceDays = await getSetting(db, "cleanup_local_device_results_days", "7");
  const uptimeDays = await getSetting(db, "cleanup_local_device_uptime_days", "90");
  const resolvedAlertDays = await getSetting(db, "cleanup_resolved_alerts_days", "30");
  const systemLogDays = await getSetting(db, "cleanup_system_logs_days", "15");
  const auditLogDays = await getSetting(db, "cleanup_audit_logs_days", "90");

  const destinationDeleted = await db("destination_results")
    .where("checked_at", "<", dateCutoff(destinationDays))
    .delete();

  const localDeviceDeleted = await db("local_device_results")
    .where("checked_at", "<", dateCutoff(localDeviceDays))
    .delete();

  const uptimeDeleted = await db("local_device_uptime_stats")
    .where("date", "<", dateCutoff(uptimeDays).slice(0, 10))
    .delete();

  const resolvedAlertsDeleted = await db("alerts")
    .where("status", "resolved")
    .where("updated_at", "<", dateCutoff(resolvedAlertDays))
    .delete();

  const systemLogsDeleted = await db("system_logs")
    .where("created_at", "<", dateCutoff(systemLogDays))
    .delete();

  const auditLogsDeleted = await db("audit_logs")
    .where("created_at", "<", dateCutoff(auditLogDays))
    .delete();

  logger.info(
    `Auto cleanup completed. destination_results=${destinationDeleted}, local_device_results=${localDeviceDeleted}, uptime_stats=${uptimeDeleted}, resolved_alerts=${resolvedAlertsDeleted}, system_logs=${systemLogsDeleted}, audit_logs=${auditLogsDeleted}`
  );
}

async function createAlert(db, type, severity, routerId, targetType, targetId, targetName, message) {
  const existing = await db("alerts")
    .where({
      type,
      target_type: targetType,
      target_id: targetId,
      status: "open",
    })
    .first();

  if (existing) return;

  await db("alerts").insert({
    type,
    severity,
    router_id: routerId,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    message,
  });
}

async function resolveAlerts(db, targetType, targetId) {
  await db("alerts")
    .where({
      target_type: targetType,
      target_id: targetId,
      status: "open",
    })
    .update({
      status: "resolved",
      recovery_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
}

function calcDestStatus(result, dest) {
  if (!result.success || (result.packet_loss || 0) >= (dest.crit_loss || 50)) return "down";

  if (
    (result.packet_loss || 0) >= (dest.warn_loss || 10) ||
    (result.avg_latency || 0) >= (dest.crit_latency || 150)
  ) {
    return "warning";
  }

  if ((result.avg_latency || 0) >= (dest.warn_latency || 50)) return "warning";

  return "online";
}

function calcDeviceStatus(result, dev) {
  if (!result.success || (result.packet_loss || 0) >= 50) return "down";

  if (
    (result.packet_loss || 0) >= (dev.loss_threshold || 20) ||
    (result.avg_latency || 0) >= (dev.crit_latency || 50)
  ) {
    return "warning";
  }

  if ((result.avg_latency || 0) >= (dev.warn_latency || 10)) return "warning";

  return "online";
}

module.exports = { startMonitoringEngine };