const logger = require("../utils/logger");

/**
 * MikroTik RouterOS API integration using routeros-client (or raw TCP socket fallback).
 * All functions gracefully degrade if connection fails.
 */

async function getClient(router) {
  try {
    // Dynamic import to avoid crash if package unavailable
    const { RouterOSAPI } = require("routeros-client");
    const client = new RouterOSAPI({
      host: router.host,
      user: router.api_username,
      password: router.api_password,
      port: router.api_port || 8728,
      tls: router.api_ssl === 1,
      timeout: 10,
    });
    await client.connect();
    return client;
  } catch (err) {
    logger.warn(`RouterOS connection failed for ${router.name} (${router.host}): ${err.message}`);
    return null;
  }
}

/**
 * Test router connection and return version/uptime info
 */
async function testRouterConnection(router) {
  const client = await getClient(router);
  if (!client) return { success: false, error: "Connection failed" };
  try {
    const identity = await client.write("/system/identity/print");
    const resource = await client.write("/system/resource/print");
    client.close();
    return {
      success: true,
      identity: identity[0]?.name,
      version: resource[0]?.version,
      uptime: resource[0]?.uptime,
      cpu_load: resource[0]?.["cpu-load"],
      free_memory: resource[0]?.["free-memory"],
      total_memory: resource[0]?.["total-memory"],
      board: resource[0]?.["board-name"],
    };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
}

/**
 * Ping a target from a MikroTik router via RouterOS API
 */
function parseTimeToMs(value) {
  if (value == null) return null;

  const raw = String(value).trim().toLowerCase();
  if (!raw || raw.includes("timeout")) return null;

  // RouterOS sometimes returns: 293ms, 293ms123us, 1s234ms, 00:00:00.293
  let totalMs = 0;
  let matched = false;

  const hourMatch = raw.match(/(\d+(?:\.\d+)?)h/);
  const minMatch = raw.match(/(\d+(?:\.\d+)?)m(?!s)/);
  const secMatch = raw.match(/(\d+(?:\.\d+)?)s(?!$|[a-z])/);
  const msMatch = raw.match(/(\d+(?:\.\d+)?)ms/);
  const usMatch = raw.match(/(\d+(?:\.\d+)?)us/);

  if (hourMatch) {
    totalMs += parseFloat(hourMatch[1]) * 3600000;
    matched = true;
  }

  if (minMatch) {
    totalMs += parseFloat(minMatch[1]) * 60000;
    matched = true;
  }

  if (secMatch) {
    totalMs += parseFloat(secMatch[1]) * 1000;
    matched = true;
  }

  if (msMatch) {
    totalMs += parseFloat(msMatch[1]);
    matched = true;
  }

  if (usMatch) {
    totalMs += parseFloat(usMatch[1]) / 1000;
    matched = true;
  }

  if (matched && Number.isFinite(totalMs)) {
    return totalMs;
  }

  // RouterOS duration format: 00:00:00.293
  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length === 3) {
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      const s = Number(parts[2]);

      if ([h, m, s].every(Number.isFinite)) {
        return ((h * 3600) + (m * 60) + s) * 1000;
      }
    }
  }

  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function buildPingArgs(router, target, count) {
  const args = [
    `=address=${target}`,
    `=count=${count}`,
  ];

  if (router.ping_src_address) {
    args.push(`=src-address=${router.ping_src_address}`);
  }

  if (router.ping_src_interface) {
    args.push(`=interface=${router.ping_src_interface}`);
  }

  return args;
}

function parsePingResults(results, target, count) {
  let summaryPacketLoss = null;
  const latencies = [];

  for (const r of results || []) {
    if (r["packet-loss"] != null) {
      const lossText = String(r["packet-loss"]).replace("%", "");
      const lossNum = parseFloat(lossText);
      if (Number.isFinite(lossNum)) summaryPacketLoss = lossNum;
    }

    const time =
      parseTimeToMs(r.time) ??
      parseTimeToMs(r["avg-rtt"]) ??
      parseTimeToMs(r["min-rtt"]) ??
      parseTimeToMs(r["max-rtt"]);

    if (time !== null && Number.isFinite(time)) {
      latencies.push(time);
    }
  }

  let packetLoss;
  if (summaryPacketLoss !== null) {
    packetLoss = summaryPacketLoss;
  } else {
    packetLoss = count > 0 ? ((count - latencies.length) / count) * 100 : 100;
  }

  packetLoss = Number.isFinite(packetLoss) ? +packetLoss.toFixed(2) : 100;

  const avgLat = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : null;

  const minLat = latencies.length ? Math.min(...latencies) : null;
  const maxLat = latencies.length ? Math.max(...latencies) : null;

  const jitter =
    latencies.length > 1
      ? latencies.slice(1).reduce((sum, v, i) => sum + Math.abs(v - latencies[i]), 0) /
      (latencies.length - 1)
      : 0;

  return {
    success: latencies.length > 0 || packetLoss < 100,
    target,
    avg_latency: avgLat !== null ? +avgLat.toFixed(1) : null,
    min_latency: minLat !== null ? +minLat.toFixed(1) : null,
    max_latency: maxLat !== null ? +maxLat.toFixed(1) : null,
    packet_loss: packetLoss,
    jitter: +jitter.toFixed(2),
  };
}

async function pingWithClient(client, router, target, count = 5) {
  try {
    const results = await client.write("/ping", buildPingArgs(router, target, count));
    return parsePingResults(results, target, count);
  } catch (err) {
    return {
      success: false,
      target,
      avg_latency: null,
      min_latency: null,
      max_latency: null,
      packet_loss: 100,
      jitter: null,
      error: err.message,
    };
  }
}
async function pingFromRouter(router, target, count = 5, timeout = 3000) {
  const client = await getClient(router);

  if (!client) {
    return {
      success: false,
      target,
      avg_latency: null,
      min_latency: null,
      max_latency: null,
      packet_loss: 100,
      jitter: null,
      error: "RouterOS API connection failed",
    };
  }

  try {
    return await pingWithClient(client, router, target, count);
  } finally {
    try {
      client.close();
    } catch (_) { }
  }
}

/**
 * Get router services, gateway info, DNS, etc.
 */
async function getRouterServices(router) {
  const client = await getClient(router);
  if (!client) {
    return {
      success: false,
      error: "Cannot connect to router",
      services: [],
      ip_addresses: [],
      dns_servers: [],
      routes: [],
    };
  }
  try {
    const [services, addresses, dns, routes, nat] = await Promise.all([
      client.write("/ip/service/print").catch(() => []),
      client.write("/ip/address/print").catch(() => []),
      client.write("/ip/dns/print").catch(() => []),
      client.write("/ip/route/print", ["?dst-address=0.0.0.0/0"]).catch(() => []),
      client.write("/ip/firewall/nat/print").catch(() => []),
    ]);
    client.close();
    return { success: true, services, ip_addresses: addresses, dns_servers: dns, routes, nat };
  } catch (err) {
    try {
      client.close();
    } catch (_) { }

    return {
      success: false,
      target,
      avg_latency: null,
      min_latency: null,
      max_latency: null,
      packet_loss: 100,
      jitter: null,
      error: err.message,
    };
  }
}

/**
 * Simulate ping result for when router is not reachable (dev/mock mode)
 */

module.exports = {
  getClient,
  testRouterConnection,
  pingFromRouter,
  pingWithClient,
  getRouterServices,
};
