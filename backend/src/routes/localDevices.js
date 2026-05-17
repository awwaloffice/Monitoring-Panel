const express = require("express");
const { getDb } = require("../db/migrate");
const { authenticate, requireRole, logAudit } = require("../middleware/auth");
const { pingFromRouter } = require("../services/mikrotik");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const db = getDb();
  const { type, router_id, search } = req.query;
  try {
    let q = db("local_devices as d").leftJoin("routers as ro","ro.id","d.router_id").select("d.*","ro.name as router_name");
    if (type) q = q.where("d.device_type",type);
    if (router_id) q = q.where("d.router_id",router_id);
    if (search) q = q.where(function(){ this.where("d.name","like",`%${search}%`).orWhere("d.ip","like",`%${search}%`); });
    const devs = await q.orderBy(["d.priority","d.name"]);

    const enriched = await Promise.all(devs.map(async (d) => {
      const r = await db("local_device_results").where({device_id:d.id}).orderBy("checked_at","desc").first();
      const upStats = await db("local_device_uptime_stats").where({device_id:d.id}).sum("uptime_seconds as up").sum("downtime_seconds as down").sum("down_events as events").first();
      const totalSecs = (upStats?.up||0)+(upStats?.down||0);
      const uptime_pct = totalSecs>0 ? +((upStats.up/totalSecs)*100).toFixed(2) : 100;

      // Flapping: count status changes in last 10 min
      const recent = await db("local_device_results").where("device_id",d.id).where("checked_at",">=",new Date(Date.now()-600000).toISOString().replace("T"," ").slice(0,19)).orderBy("checked_at","asc").select("status");
      let changes=0;
      for(let i=1;i<recent.length;i++) if(recent[i].status!==recent[i-1].status) changes++;

      return { ...d, avg_latency:r?.avg_latency?+(r.avg_latency).toFixed(2):null,
        packet_loss:r?.packet_loss?+(r.packet_loss).toFixed(2):null,
        status:r?.status||"unknown", last_checked:r?.checked_at,
        uptime_pct, total_uptime_seconds:upStats?.up||0, total_downtime_seconds:upStats?.down||0,
        down_events:upStats?.events||0, flapping:changes>=3 };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  const db = getDb();
  try {
    const dev = await db("local_devices as d").leftJoin("routers as ro","ro.id","d.router_id")
      .select("d.*","ro.name as router_name","ro.host as router_host").where("d.id",req.params.id).first();
    if (!dev) return res.status(404).json({ error: "Device not found" });

    const stats = await db("local_device_results").where({device_id:dev.id}).min("min_latency as min_l").avg("avg_latency as avg_l").max("max_latency as max_l").avg("packet_loss as avg_loss").avg("jitter as avg_jitter").first();
    const upStats = await db("local_device_uptime_stats").where({device_id:dev.id}).sum("uptime_seconds as total_up").sum("downtime_seconds as total_down").sum("down_events as events").first();
    const lastDown = await db("local_device_results").where({device_id:dev.id,status:"down"}).orderBy("checked_at","desc").first();
    const lastRecovery = await db("local_device_results").where({device_id:dev.id,status:"online"}).orderBy("checked_at","desc").first();

    res.json({ ...dev, ...stats, total_up:upStats?.total_up||0, total_down_time:upStats?.total_down||0,
      down_events:upStats?.events||0, last_down_time:lastDown?.checked_at, last_recovery_time:lastRecovery?.checked_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/history", async (req, res) => {
  const db = getDb();
  const { range="1h" } = req.query;
  const minutes = {"5m":5,"1h":60,"24h":1440,"7d":10080,"30d":43200}[range]||60;
  const since = new Date(Date.now()-minutes*60000).toISOString().replace("T"," ").slice(0,19);
  try {
    const history = await db("local_device_results").where("device_id",req.params.id).where("checked_at",">=",since)
      .select("avg_latency","min_latency","max_latency","packet_loss","jitter","status","checked_at as ts").orderBy("checked_at","asc");
    const daily = await db("local_device_uptime_stats").where("device_id",req.params.id)
      .select("date","uptime_seconds","downtime_seconds","availability").orderBy("date","desc").limit(30);
    res.json({ history, daily });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", requireRole("full_access","write"), async (req, res) => {
  const db = getDb();
  const { name,ip,device_type="Other",location,router_id,description,enabled=1,priority="medium",warn_latency=10,crit_latency=50,loss_threshold=20,check_interval=30 } = req.body;
  if (!name||!ip) return res.status(400).json({ error: "name and ip required" });
  try {
    const [id] = await db("local_devices").insert({name,ip,device_type,location,router_id:router_id||null,description,enabled,priority,warn_latency,crit_latency,loss_threshold,check_interval});
    logAudit(db,{user_id:req.user.id,username:req.user.username,action:"create_local_device",module:"local_devices",target:String(id),ip_address:req.ip});
    res.status(201).json({ id, message:"Device created" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", requireRole("full_access","write"), async (req, res) => {
  const db = getDb();
  const { name,ip,device_type,location,router_id,description,enabled,priority,warn_latency,crit_latency,loss_threshold,check_interval } = req.body;
  try {
    await db("local_devices").where({id:req.params.id}).update({name,ip,device_type,location,router_id:router_id||null,description,enabled,priority,warn_latency,crit_latency,loss_threshold,check_interval,updated_at:new Date().toISOString()});
    logAudit(db,{user_id:req.user.id,username:req.user.username,action:"update_local_device",module:"local_devices",target:req.params.id,ip_address:req.ip});
    res.json({ message:"Device updated" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", requireRole("full_access"), async (req, res) => {
  const db = getDb();
  try {
    await db("local_devices").where({id:req.params.id}).delete();
    res.json({ message:"Device deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/test", async (req, res) => {
  const db = getDb();
  const dev = await db("local_devices").where({id:req.params.id}).first();
  if (!dev) return res.status(404).json({ error: "Device not found" });
  const r = await db("routers").where({id:dev.router_id}).first();
  if (!r) return res.status(400).json({ error: "No assigned router" });
  const result = await pingFromRouter(r,dev.ip,5,3000);
  logAudit(db,{user_id:req.user.id,username:req.user.username,action:"manual_ping_device",module:"local_devices",target:dev.name,ip_address:req.ip});
  res.json(result);
});

module.exports = router;
