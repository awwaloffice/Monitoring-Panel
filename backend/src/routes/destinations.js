const express = require("express");
const { getDb } = require("../db/migrate");
const { authenticate, requireRole, logAudit } = require("../middleware/auth");
const { pingFromRouter } = require("../services/mikrotik");

const router = express.Router();
router.use(authenticate);

function getStatus(lat, loss, wLat=50, cLat=150, wLoss=10, cLoss=50) {
  if (lat==null && loss==null) return "unknown";
  if ((loss||0)>=cLoss) return "down";
  if ((loss||0)>=wLoss||(lat||0)>=cLat) return "warning";
  if ((lat||0)>=wLat) return "warning";
  return "online";
}
function calcHealth(lat, loss) {
  if (lat==null) return null;
  return Math.round((Math.max(0,100-(loss||0)*2)+Math.max(0,100-Math.max(0,(lat||0)-20)*0.5))/2);
}

router.get("/", async (req, res) => {
  const db = getDb();
  const { group, search, router_id, router_group } = req.query;
  try {
    let q = db("destinations");
    if (group) q = q.where({grp:group});
    if (search) q = q.where(function() { this.where("name","like",`%${search}%`).orWhere("address","like",`%${search}%`); });
    const dests = await q.orderBy(["grp","name"]);

    const enriched = await Promise.all(dests.map(async (d) => {
  // Average across all routers - latest result per router
  let routerQ = db("routers").where({ enabled: 1 }).select("id", "location");

if (router_id) {
  routerQ = routerQ.where({ id: router_id });
}

if (router_group) {
  routerQ = routerQ.where({ location: router_group });
}

const routers = await routerQ;

  let latSum = 0;
  let lossSum = 0;
  let jSum = 0;
  let latCnt = 0;
  let lossCnt = 0;
  let jCnt = 0;
  let resultCnt = 0;
  let onlineCnt = 0;
  let warningCnt = 0;
  let downCnt = 0;
  let lastChecked = null;
  let currentLatency = null;

  for (const r of routers) {
    const res = await db("destination_results")
      .where({ destination_id: d.id, router_id: r.id })
      .orderBy("checked_at", "desc")
      .first();

    if (!res) continue;

    resultCnt++;

    if (!lastChecked || res.checked_at > lastChecked) {
  lastChecked = res.checked_at;
  currentLatency = res.avg_latency != null ? Number(res.avg_latency) : null;
}

    if (res.status === "down") downCnt++;
    else if (res.status === "warning") warningCnt++;
    else if (res.status === "online") onlineCnt++;

    if (res.avg_latency != null) {
      latSum += Number(res.avg_latency);
      latCnt++;
    }

    // Down হলে packet_loss null থাকলেও 100% ধরতে হবে
    if (res.packet_loss != null) {
      lossSum += Number(res.packet_loss);
      lossCnt++;
    } else if (res.status === "down") {
      lossSum += 100;
      lossCnt++;
    }

    if (res.jitter != null) {
      jSum += Number(res.jitter);
      jCnt++;
    }
  }

  const avg_latency = latCnt ? +(latSum / latCnt).toFixed(2) : null;
  const avg_loss = lossCnt ? +(lossSum / lossCnt).toFixed(2) : null;
  const avg_jitter = jCnt ? +(jSum / jCnt).toFixed(2) : null;

  let status = "unknown";
  if (resultCnt > 0) {
    if (onlineCnt === 0 && downCnt > 0) status = "down";
    else if (downCnt > 0 || warningCnt > 0) status = "warning";
    else status = "online";
  }

  return {
  ...d,
  current_latency: currentLatency,
  avg_latency,
  avg_loss,
  avg_jitter,
  last_checked: lastChecked,
  status,
  health_score: calcHealth(avg_latency, avg_loss),
};
}));
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  const db = getDb();
  try {
    const dest = await db("destinations").where({id:req.params.id}).first();
    if (!dest) return res.status(404).json({ error: "Destination not found" });
    const routers = await db("routers").where({enabled:1});
    const router_results = await Promise.all(routers.map(async (ro) => {
      const r = await db("destination_results").where({destination_id:dest.id,router_id:ro.id}).orderBy("checked_at","desc").first();
      return { router_id:ro.id, router_name:ro.name, location:ro.location,
        avg_latency:r?.avg_latency, min_latency:r?.min_latency, max_latency:r?.max_latency,
        packet_loss:r?.packet_loss, jitter:r?.jitter, status:r?.status, checked_at:r?.checked_at };
    }));
    res.json({ ...dest, router_results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/history", async (req, res) => {
  const db = getDb();
  const { range="1h", router_id } = req.query;
  const minutes = {"5m":5,"1h":60,"24h":1440,"7d":10080,"30d":43200}[range]||60;
  const since = new Date(Date.now()-minutes*60000).toISOString().replace("T"," ").slice(0,19);
  try {
    let q = db("destination_results as dr").join("routers as ro","ro.id","dr.router_id")
      .where("dr.destination_id",req.params.id).where("dr.checked_at",">=",since)
      .select("dr.router_id","ro.name as router_name","dr.avg_latency","dr.min_latency","dr.max_latency","dr.packet_loss","dr.jitter","dr.status","dr.checked_at as ts")
      .orderBy("dr.checked_at","asc");
    if (router_id) q = q.where("dr.router_id",router_id);
    res.json(await q);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", requireRole("full_access","write"), async (req, res) => {
  const db = getDb();
  const { name,address,grp="Other",description,enabled=1,warn_latency=50,crit_latency=150,warn_loss=10,crit_loss=50,check_interval=60,packet_count=5,timeout=3000 } = req.body;
  if (!name||!address) return res.status(400).json({ error: "name and address required" });
  try {
    const [id] = await db("destinations").insert({name,address,grp,description,enabled,warn_latency,crit_latency,warn_loss,crit_loss,check_interval,packet_count,timeout});
    logAudit(db,{user_id:req.user.id,username:req.user.username,action:"create_destination",module:"destinations",target:String(id),ip_address:req.ip});
    res.status(201).json({ id, message:"Destination created" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", requireRole("full_access","write"), async (req, res) => {
  const db = getDb();
  const { name,address,grp,description,enabled,warn_latency,crit_latency,warn_loss,crit_loss,check_interval,packet_count,timeout } = req.body;
  try {
    await db("destinations").where({id:req.params.id}).update({name,address,grp,description,enabled,warn_latency,crit_latency,warn_loss,crit_loss,check_interval,packet_count,timeout,updated_at:new Date().toISOString()});
    logAudit(db,{user_id:req.user.id,username:req.user.username,action:"update_destination",module:"destinations",target:req.params.id,ip_address:req.ip});
    res.json({ message:"Destination updated" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", requireRole("full_access"), async (req, res) => {
  const db = getDb();
  try {
    await db("destinations").where({id:req.params.id}).delete();
    res.json({ message:"Destination deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/test", async (req, res) => {
  const db = getDb();
  const dest = await db("destinations").where({id:req.params.id}).first();
  if (!dest) return res.status(404).json({ error: "Destination not found" });
  const r = req.body.router_id
    ? await db("routers").where({id:req.body.router_id}).first()
    : await db("routers").where({enabled:1}).first();
  if (!r) return res.status(400).json({ error: "No router available" });
  const result = await pingFromRouter(r,dest.address,dest.packet_count,dest.timeout);
  logAudit(db,{user_id:req.user.id,username:req.user.username,action:"manual_ping_destination",module:"destinations",target:dest.name,ip_address:req.ip});
  res.json(result);
});

module.exports = router;
