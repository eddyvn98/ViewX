import Express from "express";
import bodyParser from "body-parser";
import useDatabase from "./services/database.js";
import * as dotenv from "dotenv";
import useRoutes from "./routers/index.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import initWebSocket from "./websocket.js";
import http from "http";
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

useDatabase();

const app = new Express();
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add Content-Security-Policy to allow external scripts, styles and connections
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' ws: wss: https://stream.binance.com:9443 https://api.binance.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;"
  );
  next();
});

useRoutes(app);

// Serve static files from the tradingview folder
app.use('/tradingview', Express.static(path.join(__dirname, 'tradingview')));
app.use(Express.static(path.join(__dirname, 'tradingview')));

// Fallback to index.html for unknown routes (for SPA behavior if needed)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.path.includes('.')) return res.status(404).send('Not Found');
  res.sendFile(path.join(__dirname, 'tradingview', 'index.html'));
});

const server = http.createServer(app);
initWebSocket(server);

server.listen(process.env.PORT || 8000, () => {
  console.log(`> 🔥 Server & WebSocket running on port ${process.env.PORT}`);
});
