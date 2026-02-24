import "./envloader.js";
import http from "http";
import useDatabase from "./services/database.js";
import { createApp } from "./app.js";
import initWebSocket from "./websocket/index.js";

const REQUIRED_ENV = ["URL_MONGOOSE", "ACCESS_TOKEN"];

function validateRequiredEnv() {
    const missing = REQUIRED_ENV.filter((key) => !(process.env[key] || "").trim());
    if (missing.length > 0) {
        console.error(`[Config] Missing required env: ${missing.join(", ")}`);
        process.exit(1);
    }
}

validateRequiredEnv();

const PORT = process.env.PORT || 8090;
const app = createApp();
const server = http.createServer(app);

useDatabase().catch((error) => {
    console.error("[DB] Unexpected startup error:", error?.message || error);
});

initWebSocket(server);

server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});
