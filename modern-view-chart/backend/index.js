import "./envloader.js";
import http from "http";
import connectDatabase from "./services/database.js";
import { createApp } from "./app.js";
import initWebSocket from "./websocket/index.js";

const REQUIRED_ENV = ["PORT", "URL_MONGOOSE", "ACCESS_TOKEN", "MAX_WS_CLIENTS", "WS_MSG_RATE_PER_10S"];
const REQUIRED_POSITIVE_INT_ENV = ["PORT", "MAX_WS_CLIENTS", "WS_MSG_RATE_PER_10S"];

function validateRequiredEnv() {
    const missing = REQUIRED_ENV.filter((key) => !(process.env[key] || "").trim());
    if (missing.length > 0) {
        console.error(`[Config] Missing required env: ${missing.join(", ")}`);
        process.exit(1);
    }

    for (const key of REQUIRED_POSITIVE_INT_ENV) {
        const value = Number.parseInt(process.env[key] || "", 10);
        if (!Number.isFinite(value) || value <= 0) {
            console.error(`[Config] Invalid value for ${key}: "${process.env[key] || ""}" (must be a positive integer)`);
            process.exit(1);
        }
    }
}

validateRequiredEnv();

const PORT = Number.parseInt(process.env.PORT, 10);
const app = createApp();
const server = http.createServer(app);

connectDatabase().catch((error) => {
    console.error("[DB] Unexpected startup error:", error?.message || error);
});

initWebSocket(server);

server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});
