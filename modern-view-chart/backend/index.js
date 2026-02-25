import "./envloader.js";
import http from "http";
import connectDatabase from "./services/database.js";
import { createApp } from "./app.js";
import initWebSocket from "./websocket/index.js";
import { logError, logInfo } from "./logger.js";
import { startRuntimeAlertMonitor } from "./services/runtimeAlertMonitor.js";

const REQUIRED_ENV = ["PORT", "URL_MONGOOSE", "ACCESS_TOKEN", "MAX_WS_CLIENTS", "WS_MSG_RATE_PER_10S"];
const REQUIRED_POSITIVE_INT_ENV = ["PORT", "MAX_WS_CLIENTS", "WS_MSG_RATE_PER_10S"];

function validateRequiredEnv() {
    const missing = REQUIRED_ENV.filter((key) => !(process.env[key] || "").trim());
    if (missing.length > 0) {
        logError("config.env.missing", { keys: missing });
        process.exit(1);
    }

    for (const key of REQUIRED_POSITIVE_INT_ENV) {
        const value = Number.parseInt(process.env[key] || "", 10);
        if (!Number.isFinite(value) || value <= 0) {
            logError("config.env.invalid_number", {
                key,
                value: process.env[key] || "",
                expected: "positive_integer",
            });
            process.exit(1);
        }
    }
}

validateRequiredEnv();

const PORT = Number.parseInt(process.env.PORT, 10);
const app = createApp();
const server = http.createServer(app);

connectDatabase().catch((error) => {
    logError("db.startup.unexpected_error", { error: error?.message || error });
});

initWebSocket(server);
const runtimeAlertMonitor = startRuntimeAlertMonitor();
if (runtimeAlertMonitor?.config) {
    logInfo("ops.alert.monitor_started", runtimeAlertMonitor.config);
}

server.listen(PORT, () => {
    logInfo("server.started", { port: PORT });
});
