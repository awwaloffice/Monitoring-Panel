const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { initDb } = require("./db/migrate");
const { startMonitoringEngine } = require("./services/monitoringEngine");
const logger = require("./utils/logger");

// Routes
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const routerRoutes = require("./routes/routers");
const destinationRoutes = require("./routes/destinations");
const localDeviceRoutes = require("./routes/localDevices");
const userRoutes = require("./routes/users");
const auditRoutes = require("./routes/auditLogs");
const settingsRoutes = require("./routes/settings");
const reportsRoutes = require("./routes/reports");
const bulkRoutes = require("./routes/bulk");
const alertRoutes = require("./routes/alerts");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: false,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/routers", routerRoutes);
app.use("/api/destinations", destinationRoutes);
app.use("/api/local-devices", localDeviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/alerts", alertRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

async function main() {
  await initDb();
  app.listen(PORT, () => {
    logger.info(`Monitoring Panel backend running on port ${PORT}`);
    startMonitoringEngine();
  });
}

main().catch((err) => {
  logger.error("Startup failed:", err);
  process.exit(1);
});
