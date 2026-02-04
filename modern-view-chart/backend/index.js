import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envPath = fs.existsSync(".env") ? ".env" : "backend/.env";
dotenv.config({ path: envPath });

import http from "http";
import useDatabase from "./services/database.js";
import { createApp } from "./app.js";
import initWebSocket from "./websocket/index.js";

const PORT = process.env.PORT || 8090;
const app = createApp();
const server = http.createServer(app);

// Init Database
useDatabase();

// Init WebSocket
initWebSocket(server);

server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
