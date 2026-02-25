import Express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import applyRoutes from "./routers/index.js";
import requireAccessToken from "./middlewares/requireAccessToken.js";
import { getDatabaseHealth } from "./services/database.js";
import { runtimeState } from "./runtime-state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAllowedOrigins() {
    const fromEnv = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    if (fromEnv.length > 0) return fromEnv;

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.trycloudflare.com",
    ];
}

function originMatches(origin, pattern) {
    if (pattern.includes("*")) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        return new RegExp(`^${escaped}$`).test(origin);
    }
    return origin === pattern;
}

function isHealthyState(state) {
    return state === "connected" || state === "connecting";
}

export function createApp() {
    const app = new Express();
    const allowedOrigins = getAllowedOrigins();

    app.use(cookieParser());
    app.use(
        cors({
            origin(origin, callback) {
                if (!origin) return callback(null, true);
                const allowed = allowedOrigins.some((pattern) => originMatches(origin, pattern));
                return allowed ? callback(null, true) : callback(new Error("CORS origin blocked"));
            },
            credentials: true,
        }),
    );
    app.use(bodyParser.json({ limit: "1mb" }));
    app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

    const apiLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const aiLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 30,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const aiTaskLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 12,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const marketLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use("/api", apiLimiter);
    app.use("/api/ai/bridge", aiLimiter);
    app.use("/api/ai/bridge/task", aiTaskLimiter);
    app.use("/api/user/data", marketLimiter);
    app.use("/api/user/prices", marketLimiter);
    app.use("/api/user/symbols", marketLimiter);

    app.use((req, res, next) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
                "img-src 'self' data: https:; " +
                "connect-src 'self' ws: wss: https://stream.binance.com:9443 https://api.binance.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;",
        );
        next();
    });

    app.get("/api/health", (req, res) => {
        const db = getDatabaseHealth();
        const status = isHealthyState(db.state) ? "ok" : "degraded";
        res.status(200).json({
            status,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            db,
            bridge_online: runtimeState.bridgeOnline,
            ws_clients: runtimeState.wsClients,
            ws_connected: runtimeState.wsClients,
            ws_dropped_rate_limit: runtimeState.wsDroppedRateLimit,
            ws_dropped_backpressure: runtimeState.wsDroppedBackpressure,
            ws_buffer_pressure: runtimeState.wsBufferPressure,
            broadcast_p95_ms: runtimeState.broadcastLoopMsP95,
            bridge_rtt_ms: null,
            version: process.env.npm_package_version || "0.1.0",
        });
    });

    app.get("/api/health/ready", (req, res) => {
        const db = getDatabaseHealth();
        const ready = db.state === "connected" && runtimeState.bridgeOnline;
        if (!ready) {
            return res.status(503).json({
                status: "not_ready",
                db_state: db.state,
                bridge_online: runtimeState.bridgeOnline,
            });
        }
        return res.status(200).json({ status: "ready" });
    });

    app.use("/api", (req, res, next) => {
        if (req.path === "/health" || req.path === "/health/ready") return next();
        return requireAccessToken(req, res, next);
    });

    applyRoutes(app);

    const tradingviewPath = path.join(__dirname, "../../tradingview");
    app.use("/tradingview", Express.static(tradingviewPath));
    app.use(Express.static(tradingviewPath));

    app.get("/*splat", (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        if (req.path.includes(".")) return res.status(404).send("Not Found");
        return res.sendFile(path.join(tradingviewPath, "index.html"));
    });

    return app;
}
