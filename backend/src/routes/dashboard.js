const express = require("express");
const { getDb } = require("../db/migrate");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);
const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL = Number(process.env.DASHBOARD_CACHE_TTL_MS || 5000);

function cacheKey(req) {
  return req.originalUrl || req.url;
}

function sendCached(req, res, data) {
  const key = cacheKey(req);

  dashboardCache.set(key, {
    time: Date.now(),
    data,
  });

  res.json(data);
}

function cacheMiddleware(req, res, next) {
  const key = cacheKey(req);
  const cached = dashboardCache.get(key);

  if (cached && Date.now() - cached.time < DASHBOARD_CACHE_TTL) {
    return res.json(cached.data);
  }

  next();
}

function destStatus(lat, loss, wLat=50, cLat=150, wLoss=10, cLoss=50) {
  if (loss == null && lat == null) return "unknown";
  if ((loss||0) >= cLoss) return "down";
  if ((loss||0) >= wLoss || (lat||0) >= cLat) return "warning";
  if ((lat||0) >= wLat) return "warning";
  return "online";
}

router.get("/summary", cacheMiddleware, async (req, res) => {
  const db = getDb();
  try {
    const [routerCount, destCount, devCount] = await Promise.all([
      db("routers").where({enabled:1}).count("id as c").first(),
      db("destinations").where({enabled:1}).count("id as c").first(),
      db("local_devices").where({enabled:1}).count("id as c").first(),
    ]);

    // Latest dest result per (dest, router) - get last result per pair
    const destRows = await db("destination_results as dr")
      .join("destinations as d", "d.id", "dr.destination_id")
      .where("d.enabled", 1)
      .select("dr.destination_id","dr.avg_latency","dr.packet_loss","dr.status")
      .orderBy("dr.checked_at", "desc");

    // Deduplicate: one per destination_id
    const seen = new Set();
    const latestDest = destRows.filter(r => { if(seen.has(r.destination_id)) return false; seen.add(r.destination_id); return true; });

    let dOnline=0,dWarn=0,dDown=0,latSum=0,lossSum=0;
    for (const r of latestDest) {
      const st = destStatus(r.avg_latency, r.packet_loss);
      if (st==="online") dOnline++; else if(st==="warning") dWarn++; else dDown++;
      latSum += r.avg_latency||0; lossSum += r.packet_loss||0;
    }

    const devRows = await db("local_device_results as r")
      .join("local_devices as d","d.id","r.device_id")
      .where("d.enabled",1)
      .select("r.device_id","d.priority","r.status")
      .orderBy("r.checked_at","desc");
    const seenD = new Set();
    const latestDev = devRows.filter(r => { if(seenD.has(r.device_id)) return false; seenD.add(r.device_id); return true; });

    let devOnline=0,devWarn=0,devDown=0,devCrit=0;
    for (const r of latestDev) {
      if (r.status==="online") devOnline++;
      else if (r.status==="warning") devWarn++;
      else if (r.status==="down") { devDown++; if(r.priority==="critical") devCrit++; }
    }

    const n = latestDest.length || 1;
    const avgLatency = (latSum/n).toFixed(1);
    const avgLoss = (lossSum/n).toFixed(1);
    const total = (destCount.c||0)+(devCount.c||0)||1;
    const healthScore = Math.round(((dOnline+devOnline)/total)*100);

    return sendCached(req, res, { routerCount:routerCount.c, destCount:destCount.c, devCount:devCount.c,
  destOnline:dOnline, destWarn:dWarn, destDown:dDown,
  devOnline, devWarn, devDown, devCrit,
  totalOnline:dOnline+devOnline, totalWarning:dWarn+devWarn, totalDown:dDown+devDown,
  avgLatency, avgLoss, healthScore });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/destination-groups", cacheMiddleware, async (req, res) => {
  const db = getDb();
  const groups = ["GGC","FNA","Games","CDN","DNS","IX","Other"];
  try {
    const result = await Promise.all(groups.map(async (grp) => {
      const dests = await db("destinations").where({ grp, enabled:1 }).select("id","warn_latency","crit_latency","warn_loss","crit_loss");
      if (!dests.length) return null;
      let online=0,warning=0,down=0,latSum=0,lossSum=0,jSum=0,cnt=0;
      for (const d of dests) {
        const r = await db("destination_results").where({destination_id:d.id}).orderBy("checked_at","desc").first();
        if (!r) continue;
        const st = destStatus(r.avg_latency,r.packet_loss,d.warn_latency,d.crit_latency,d.warn_loss,d.crit_loss);
        if(st==="online") online++; else if(st==="warning") warning++; else down++;
        latSum+=r.avg_latency||0; lossSum+=r.packet_loss||0; jSum+=r.jitter||0; cnt++;
      }
      return { group:grp, total:dests.length, online, warning, down,
        avg_latency: cnt ? +(latSum/cnt).toFixed(2) : 0,
        avg_loss: cnt ? +(lossSum/cnt).toFixed(2) : 0,
        avg_jitter: cnt ? +(jSum/cnt).toFixed(2) : 0,
        health: dests.length ? Math.round((online/dests.length)*100) : 100 };
    }));
    return sendCached(req, res, result.filter(Boolean));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/local-device-summary", cacheMiddleware, async (req, res) => {
  const db = getDb();
  const types = ["ONU","Switch","OLT","AP","CCTV","Server","NAS","Gateway","Printer","Other"];
  try {
    const result = await Promise.all(types.map(async (type) => {
      const devs = await db("local_devices").where({device_type:type,enabled:1}).select("id");
      if (!devs.length) return null;
      let online=0,warning=0,down=0;
      for (const d of devs) {
        const r = await db("local_device_results").where({device_id:d.id}).orderBy("checked_at","desc").first();
        if (!r) continue;
        if(r.status==="online") online++; else if(r.status==="warning") warning++; else if(r.status==="down") down++;
      }
      return { type, total:devs.length, online, warning, down };
    }));
    return sendCached(req, res, result.filter(r => r && r.total > 0));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/recent-alerts", cacheMiddleware, async (req, res) => {
  try {
    const alerts = await getDb()("alerts").orderBy("created_at","desc").limit(20);
    return sendCached(req, res, alerts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
