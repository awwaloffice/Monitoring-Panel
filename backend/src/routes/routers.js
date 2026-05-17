const express = require("express");
const { getDb } = require("../db/migrate");
const { authenticate, requireRole, logAudit } = require("../middleware/auth");
const { testRouterConnection, getRouterServices } = require("../services/mikrotik");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const db = getDb();
  try {
    const routers = await db("routers").orderBy("name");
    const enriched = await Promise.all(routers.map(async (r) => {
      const destCount = await db("destinations").where({enabled:1}).count("id as c").first();
      const deviceCount = await db("local_devices").where({router_id:r.id,enabled:1}).count("id as c").first();
      const stats = await db("destination_results").where({router_id:r.id})
        .avg("avg_latency as avg_latency").avg("packet_loss as avg_loss").first();
      return { ...r, dest_count: destCount.c, device_count: deviceCount.c,
        avg_latency: stats?.avg_latency, avg_loss: stats?.avg_loss };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const r = await getDb()("routers").where({id:req.params.id}).first();
    if (!r) return res.status(404).json({ error: "Router not found" });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", requireRole("full_access","write"), async (req, res) => {
  const db = getDb();
  const { name, host, api_username, api_password, api_port=8728, api_ssl=0, location, description, enabled=1, ping_src_address, ping_src_interface } = req.body;
  if (!name||!host||!api_username||!api_password) return res.status(400).json({ error: "name, host, api_username, api_password required" });
  try {
    const [id] = await db("routers").insert({ name,host,api_username,api_password,api_port,api_ssl,location,description,enabled,ping_src_address,ping_src_interface });
    logAudit(db, { user_id:req.user.id, username:req.user.username, action:"create_router", module:"routers", target:String(id), ip_address:req.ip });
    res.status(201).json({ id, message: "Router created" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", requireRole("full_access","write"), async (req, res) => {
  const db = getDb();
  const { name,host,api_username,api_password,api_port,api_ssl,location,description,enabled,ping_src_address,ping_src_interface } = req.body;
  try {
    await db("routers").where({id:req.params.id}).update({ name,host,api_username,api_password,api_port,api_ssl,location,description,enabled,ping_src_address,ping_src_interface,updated_at:new Date().toISOString() });
    logAudit(db, { user_id:req.user.id, username:req.user.username, action:"update_router", module:"routers", target:req.params.id, ip_address:req.ip });
    res.json({ message: "Router updated" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", requireRole("full_access"), async (req, res) => {
  const db = getDb();
  try {
    await db("routers").where({id:req.params.id}).delete();
    logAudit(db, { user_id:req.user.id, username:req.user.username, action:"delete_router", module:"routers", target:req.params.id, ip_address:req.ip });
    res.json({ message: "Router deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/test", async (req, res) => {
  const db = getDb();
  const r = await db("routers").where({id:req.params.id}).first();
  if (!r) return res.status(404).json({ error: "Router not found" });
  const result = await testRouterConnection(r);
  await db("routers").where({id:r.id}).update({ connection_status: result.success?"connected":"disconnected", ros_version:result.version||r.ros_version, uptime:result.uptime||r.uptime, last_seen:new Date().toISOString() });
  logAudit(db, { user_id:req.user.id, username:req.user.username, action:"test_router", module:"routers", target:req.params.id, ip_address:req.ip });
  res.json(result);
});

router.get("/:id/services", async (req, res) => {
  const r = await getDb()("routers").where({id:req.params.id}).first();
  if (!r) return res.status(404).json({ error: "Router not found" });
  res.json(await getRouterServices(r));
});

router.get("/:id/report", async (req, res) => {
  const db = getDb();
  const r = await db("routers").where({id:req.params.id}).first();
  if (!r) return res.status(404).json({ error: "Router not found" });
  const { from, to } = req.query;
  let q = db("destination_results as dr").join("destinations as d","d.id","dr.destination_id")
    .where("dr.router_id", r.id).select("dr.*","d.name as dest_name","d.grp").orderBy("dr.checked_at","desc").limit(500);
  if (from) q = q.where("dr.checked_at",">=",from);
  if (to) q = q.where("dr.checked_at","<=",to);
  const results = await q;
  res.json({ router: r, results });
});

module.exports = router;
