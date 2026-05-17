const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = process.env.LOG_DIR || path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) =>
          `${timestamp} [${level}] ${stack || message}`
        )
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, "app.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

module.exports = logger;
