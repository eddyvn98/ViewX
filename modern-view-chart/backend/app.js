import Express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import os from "os";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import applyRoutes from "./routers/index.js";
import requireAuth from "./middlewares/requireAuth.js";
import { getDatabaseHealth } from "./services/database.js";
import { runtimeState } from "./runtime-state.js";
import { normalizeUserRole } from "./auth/roles.js";
import { getActiveRefreshTokenCount } from "./auth/userJwt.js";
import { emergencyConfig } from "./config/emergency.js";

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

const EMERGENCY_BLOCKED_HTTP_PREFIXES = [
    "/api/ai/bridge/task",
    "/api/ai/bridge/execute",
    "/api/user/data",
    "/api/user/prices",
    "/api/user/symbols",
    "/api/user/bollinger",
    "/api/user/rsi",
];

export function createApp() {
    const app = new Express();
    const allowedOrigins = getAllowedOrigins();
    const isProduction = process.env.NODE_ENV === "production";

    app.disable("x-powered-by");
    app.use(
        helmet({
            contentSecurityPolicy: false,
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            frameguard: { action: "deny" },
            hsts: isProduction
                ? {
                      maxAge: 15552000,
                      includeSubDomains: true,
                  }
                : false,
            permissionsPolicy: {
                features: {
                    camera: [],
                    geolocation: [],
                    microphone: [],
                },
            },
        }),
    );
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
        limit: emergencyConfig.limits.apiPerMin,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const aiLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: emergencyConfig.limits.aiPerMin,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const aiTaskLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: emergencyConfig.limits.aiTaskPerMin,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const marketLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: emergencyConfig.limits.marketPerMin,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const publicStateLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 30,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const authLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use("/api", apiLimiter);
    app.use("/api/auth/login", authLimiter);
    app.use("/api/auth/google", authLimiter);
    app.use("/api/auth/refresh", authLimiter);
    app.use("/api/ai/bridge", aiLimiter);
    app.use("/api/ai/bridge/task", aiTaskLimiter);
    app.use("/api/user/state/public", publicStateLimiter);
    app.use("/api/user/data", marketLimiter);
    app.use("/api/user/prices", marketLimiter);
    app.use("/api/user/symbols", marketLimiter);

    app.use((req, res, next) => {
        if (!emergencyConfig.enabled || !emergencyConfig.blockHeavyHttp) return next();
        if (req.path === "/api/health" || req.path === "/api/health/ready" || req.path === "/api/metrics") return next();

        const blocked = EMERGENCY_BLOCKED_HTTP_PREFIXES.some((prefix) => req.path.startsWith(prefix));
        if (!blocked) return next();

        res.setHeader("Retry-After", "60");
        res.setHeader("x-emergency-mode", "1");
        return res.status(503).json({
            error: "Service temporarily restricted",
            code: "emergency_mode_restriction",
        });
    });

    app.use((req, res, next) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; " +
                "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
                "img-src 'self' data: https:; " +
                "connect-src 'self' ws: wss: https://stream.binance.com:9443 https://api.binance.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
                "object-src 'none'; " +
                "base-uri 'self'; " +
                "frame-ancestors 'none';",
        );
        next();
    });

    app.get("/api/health", (req, res) => {
        const db = getDatabaseHealth();
        const status = isHealthyState(db.state) ? "ok" : "degraded";
        res.status(200).json({
            status,
            timestamp: new Date().toISOString(),
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

    app.get("/api/metrics", (req, res, next) => requireAuth(req, res, next), (req, res) => {
        const authType = req.auth?.type;
        const role = normalizeUserRole(req.auth?.role);
        if (authType !== "service" && role !== "admin") {
            return res.status(403).json({ error: "Forbidden" });
        }

        const memory = process.memoryUsage();
        const cpu = process.cpuUsage();
        const loadAverage = os.loadavg();

        return res.status(200).json({
            ts: new Date().toISOString(),
            process: {
                pid: process.pid,
                uptime_sec: Math.round(process.uptime()),
                rss_bytes: memory.rss,
                heap_used_bytes: memory.heapUsed,
                heap_total_bytes: memory.heapTotal,
                external_bytes: memory.external,
                cpu_user_micros: cpu.user,
                cpu_system_micros: cpu.system,
                loadavg_1m: loadAverage[0] || 0,
                loadavg_5m: loadAverage[1] || 0,
                loadavg_15m: loadAverage[2] || 0,
            },
            websocket: {
                connected: runtimeState.wsClients,
                dropped_rate_limit: runtimeState.wsDroppedRateLimit,
                dropped_backpressure: runtimeState.wsDroppedBackpressure,
                buffer_pressure: runtimeState.wsBufferPressure,
                broadcast_loop_p95_ms: runtimeState.broadcastLoopMsP95,
            },
            bridge: {
                online: runtimeState.bridgeOnline,
            },
            auth: {
                active_refresh_tokens: getActiveRefreshTokenCount(),
            },
            db: getDatabaseHealth(),
            emergency_mode: emergencyConfig.enabled,
        });
    });

    app.use("/api", (req, res, next) => {
        if (req.path === "/health" || req.path === "/health/ready") return next();
        const publicAuthPaths = new Set([
            "/auth/login",
            "/auth/google",
            "/auth/refresh",
            "/auth/logout",
            "/auth/telegram/webhook",
            "/user/state/public",
            "/user/trade-logs/public",
            "/user/trade-stats/public",
        ]);
        if (publicAuthPaths.has(req.path)) return next();
        return requireAuth(req, res, next);
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
