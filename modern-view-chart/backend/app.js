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
import mongoose from "mongoose";
import { userStateModel } from "./model/user_state.js";
import { userModel } from "./model/user.js";
import { tradeLogModel } from "./model/trade_log.js";

let monitorConnectionPromise = null;

async function getMonitorDb() {
    const monitorUri = (process.env.MONITOR_MONGO_URI || "mongodb://viewx-mongo:27017/viewx?directConnection=true").trim();
    if (!monitorUri) return null;

    if (!monitorConnectionPromise) {
        monitorConnectionPromise = mongoose
            .createConnection(monitorUri, { serverSelectionTimeoutMS: 3000 })
            .asPromise()
            .catch((error) => {
                monitorConnectionPromise = null;
                throw error;
            });
    }

    const connection = await monitorConnectionPromise;
    return connection?.db || null;
}

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
    app.use(bodyParser.json({ limit: "10mb" }));
    app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

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

    const authEntryLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const authRefreshLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 60,
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use("/api", apiLimiter);
    app.use("/api/auth/login", authEntryLimiter);
    app.use("/api/auth/google", authEntryLimiter);
    app.use("/api/auth/refresh", authRefreshLimiter);
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

    app.get("/api/metrics/user-activity", (req, res, next) => requireAuth(req, res, next), async (req, res) => {
        const authType = req.auth?.type;
        const role = normalizeUserRole(req.auth?.role);
        if (authType !== "service" && role !== "admin") {
            return res.status(403).json({ error: "Forbidden" });
        }

        const rawHours = Number.parseInt(String(req.query?.hours ?? "6"), 10);
        const hours = Number.isFinite(rawHours) ? Math.max(1, Math.min(24 * 30, rawHours)) : 6;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const recentActivityFilter = { $or: [{ updatedAt: { $gte: since } }, { lastSyncedAt: { $gte: since } }] };

        let activeUsers = [];
        let guestSessions = 0;
        let userSessions = 0;
        let tradeLogs = 0;
        let source = "primary";

        try {
            const monitorDb = await getMonitorDb();
            if (monitorDb) {
                const [activeUserStates, guestCount, userCount, tradeCount] = await Promise.all([
                    monitorDb
                        .collection("userstates")
                        .find({ scopeType: "user", ...recentActivityFilter }, { projection: { scopeId: 1, updatedAt: 1, lastSyncedAt: 1 } })
                        .sort({ updatedAt: -1 })
                        .toArray(),
                    monitorDb.collection("userstates").distinct("scopeId", { scopeType: "guest", ...recentActivityFilter }).then((ids) => ids.length),
                    monitorDb.collection("userstates").countDocuments({ scopeType: "user", ...recentActivityFilter }),
                    monitorDb.collection("tradelogs").countDocuments({ created_at: { $gte: since } }),
                ]);

                const userIds = Array.from(
                    new Set(
                        activeUserStates
                            .map((state) => String(state.scopeId || "").trim())
                            .filter((id) => mongoose.isValidObjectId(id)),
                    ),
                ).map((id) => new mongoose.Types.ObjectId(id));

                const users = userIds.length
                    ? await monitorDb
                          .collection("users")
                          .find({ _id: { $in: userIds } }, { projection: { username: 1, role: 1, createdAt: 1, updatedAt: 1 } })
                          .toArray()
                    : [];
                const userById = new Map(users.map((user) => [String(user._id), user]));

                activeUsers = activeUserStates.map((state) => {
                    const user = userById.get(String(state.scopeId));
                    return {
                        userId: String(state.scopeId || ""),
                        username: user?.username || null,
                        role: user?.role || null,
                        stateUpdatedAt: state.updatedAt || null,
                        lastSyncedAt: state.lastSyncedAt || null,
                        userCreatedAt: user?.createdAt || null,
                        userUpdatedAt: user?.updatedAt || null,
                    };
                });
                guestSessions = guestCount;
                userSessions = userCount;
                tradeLogs = tradeCount;
                source = "docker_monitor";
            }
        } catch {
            source = "primary_fallback";
        }

        if (source !== "docker_monitor") {
            const activeUserStates = await userStateModel
                .find(
                    {
                        scopeType: "user",
                        ...recentActivityFilter,
                    },
                    { scopeId: 1, updatedAt: 1, lastSyncedAt: 1 },
                )
                .sort({ updatedAt: -1 })
                .lean();

            const userIds = Array.from(
                new Set(
                    activeUserStates
                        .map((state) => String(state.scopeId || "").trim())
                        .filter((id) => mongoose.isValidObjectId(id)),
                ),
            );

            const users = await userModel
                .find(
                    {
                        _id: { $in: userIds },
                    },
                    { username: 1, role: 1, createdAt: 1, updatedAt: 1 },
                )
                .lean();

            const userById = new Map(users.map((user) => [String(user._id), user]));
            activeUsers = activeUserStates.map((state) => {
                const user = userById.get(String(state.scopeId));
                return {
                    userId: String(state.scopeId || ""),
                    username: user?.username || null,
                    role: user?.role || null,
                    stateUpdatedAt: state.updatedAt || null,
                    lastSyncedAt: state.lastSyncedAt || null,
                    userCreatedAt: user?.createdAt || null,
                    userUpdatedAt: user?.updatedAt || null,
                };
            });

            const [guestCount, userCount, tradeCount] = await Promise.all([
                userStateModel.distinct("scopeId", { scopeType: "guest", ...recentActivityFilter }).then((ids) => ids.length),
                userStateModel.countDocuments({ scopeType: "user", ...recentActivityFilter }),
                tradeLogModel.countDocuments({ created_at: { $gte: since } }),
            ]);
            guestSessions = guestCount;
            userSessions = userCount;
            tradeLogs = tradeCount;
        }

        return res.status(200).json({
            ts: new Date().toISOString(),
            timezone: "UTC",
            hours,
            since: since.toISOString(),
            source,
            summary: {
                logged_in_users: activeUsers.length,
                user_sessions: userSessions,
                guest_sessions: guestSessions,
                tradelogs: tradeLogs,
            },
            users: activeUsers,
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
            "/user/symbols",
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

