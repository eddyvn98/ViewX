import { WebSocketServer } from "ws";
import { setupMessageRouter } from "./messageRouter.js";
import { broadcastPricesToSubscribers, broadcastChartCandles } from "./services/broadcastService.js";
import { startBinanceTickerStream } from "./services/binanceTickerService.js";
import { binanceSimulator } from "../services/binanceSimulator.js";
import {
    incrementWsDroppedRateLimit,
    recordBroadcastLoopDuration,
    runtimeState,
    setBridgeOnline,
    setWsClients,
} from "../runtime-state.js";
import { safeSend } from "./wsSend.js";
import {
    addDefaultPriceClient,
    collectInterestSymbolsFromIndex,
    createSubscriptionIndex,
    removeClientFromIndexes,
} from "./subscriptionIndex.js";
import { extractBearerCredential, isAuthorizedWithCredential } from "../auth/credential.js";
import { resolveUserAuthFromAccessToken } from "../auth/userSession.js";
import { logInfo, logWarn } from "../logger.js";
import { emergencyConfig } from "../config/emergency.js";

export const clients = new Map();
export const mt5Prices = new Map();

const BRIDGE_TOPICS = new Set([
    "mt5_update",
    "mt5_positions_update",
    "mt5_symbols_available",
    "mt5_candles",
    "mt5_candles_at",
    "mt5_history_deals",
    "mt5_symbol_info",
    "mt5_order_result",
]);

function parseBooleanEnv(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
}

function resolveQueryAuthPolicy() {
    const allowQueryAuth = parseBooleanEnv(process.env.WS_ALLOW_QUERY_AUTH, false);
    const fromEnv = (process.env.WS_QUERY_AUTH_DEPRECATED_UNTIL || "").trim();
    const fallbackMs = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const fallbackIso = new Date(fallbackMs).toISOString();
    const deprecatedUntil = new Date(fromEnv || fallbackIso);
    const untilMs = Number.isFinite(deprecatedUntil.getTime()) ? deprecatedUntil.getTime() : fallbackMs;

    return {
        allowQueryAuth,
        deprecatedUntilIso: new Date(untilMs).toISOString(),
        isDeprecatedWindowOpen(nowMs = Date.now()) {
            return nowMs <= untilMs;
        },
    };
}

function emitWsError(ws, payload) {
    safeSend(ws, JSON.stringify({ topic: "error", ...payload }));
}

async function resolveAuthContext(request, queryAuthPolicy) {
    const expectedToken = (process.env.ACCESS_TOKEN || "").trim();

    const bearerCredential = extractBearerCredential(request.headers?.authorization || "");
    const bearerUserAuth = await resolveUserAuthFromAccessToken(bearerCredential);
    if (bearerUserAuth?.userId) {
        return {
            type: "user",
            userId: bearerUserAuth.userId,
            role: bearerUserAuth.role,
            via: "authorization_header",
        };
    }

    const protocolHeader = request.headers?.["sec-websocket-protocol"] || "";
    const protocolTokens = String(protocolHeader)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    const protocolBearerCredentials = [];
    for (const protocolToken of protocolTokens) {
        if (protocolToken.startsWith("bearer.")) {
            const protocolValue = protocolToken.slice("bearer.".length);
            protocolBearerCredentials.push(protocolValue);
            const protocolUserAuth = await resolveUserAuthFromAccessToken(protocolValue);
            if (protocolUserAuth?.userId) {
                return {
                    type: "user",
                    userId: protocolUserAuth.userId,
                    role: protocolUserAuth.role,
                    via: "sec_websocket_protocol",
                };
            }
        }
    }

    if (!expectedToken) return null;

    if (isAuthorizedWithCredential({
        expectedToken,
        bearerCredential,
    })) {
        return { type: "service", via: "authorization_header" };
    }

    for (const credential of protocolBearerCredentials) {
        if (
            isAuthorizedWithCredential({
                expectedToken,
                bearerCredential: credential,
            })
        ) {
            return { type: "service", via: "sec_websocket_protocol" };
        }
    }

    const parsed = new URL(request.url || "/", "http://localhost");
    if (parsed.searchParams.has("access_token") || parsed.searchParams.has("access_ticket")) {
        logWarn("auth.ws.query_rejected", {
            reason: queryAuthPolicy.allowQueryAuth ? "sunset_expired" : "query_auth_disabled",
            has_access_token: parsed.searchParams.has("access_token"),
            has_access_ticket: parsed.searchParams.has("access_ticket"),
        });
    }

    return { type: "guest", role: "viewer", via: "anonymous" };
}

export default function initWebSocket(server) {
    const maxClients = emergencyConfig.limits.wsClients;
    const msgRate = emergencyConfig.limits.wsMsgPer10s;
    const bridgeMsgRate = emergencyConfig.limits.bridgeWsMsgPer10s;
    const bridgeSymbolsRefreshSec = Number.parseInt(process.env.BRIDGE_SYMBOL_REFRESH_SEC || "2", 10);
    const heartbeatIntervalMs = Number.parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || "30000", 10);
    const wsBroadcastIntervalMs = emergencyConfig.limits.wsBroadcastIntervalMs;
    const binanceBroadcastIntervalMs = emergencyConfig.limits.binanceBroadcastIntervalMs;
    const windowMs = 10_000;
    const queryAuthPolicy = resolveQueryAuthPolicy();

    const wss = new WebSocketServer({
        server,
        maxPayload: 10 * 1024 * 1024,
    });
    const subscriptionIndex = createSubscriptionIndex();

    startBinanceTickerStream();
    if (emergencyConfig.enabled) {
        logWarn("ops.emergency_mode.ws_enabled", {
            max_clients: maxClients,
            msg_rate_per_10s: msgRate,
            bridge_msg_rate_per_10s: bridgeMsgRate,
            ws_broadcast_interval_ms: wsBroadcastIntervalMs,
            binance_broadcast_interval_ms: binanceBroadcastIntervalMs,
        });
    }

    let broadcastTickRunning = false;
    setInterval(() => {
        if (broadcastTickRunning) return;
        broadcastTickRunning = true;
        const startAt = Date.now();

        Promise.resolve()
            .then(async () => {
                await broadcastPricesToSubscribers({ clients, mt5Prices, subscriptionIndex });
                await broadcastChartCandles({ clients, mt5Prices, subscriptionIndex });
            })
            .finally(() => {
                recordBroadcastLoopDuration(Date.now() - startAt);
                broadcastTickRunning = false;
            });
    }, Math.max(250, wsBroadcastIntervalMs));

    setInterval(() => {
        binanceSimulator.updatePnL();
        broadcastBinanceState();
    }, Math.max(500, binanceBroadcastIntervalMs));

    let lastInterestHash = null;
    setInterval(() => {
        const bridgeSockets = [];
        for (const [ws, meta] of clients.entries()) {
            if (meta?.isBridgeAuthenticated && ws.readyState === ws.OPEN) bridgeSockets.push(ws);
        }
        if (bridgeSockets.length === 0) return;

        const symbols = collectInterestSymbolsFromIndex(subscriptionIndex);
        const hash = symbols.join("|");
        if (hash === lastInterestHash) return;
        lastInterestHash = hash;

        const payload = JSON.stringify({
            topic: "bridge_symbols_interest",
            symbols,
            source: "client_interest",
            updated_at: Date.now(),
        });

        for (const bridgeWs of bridgeSockets) {
            safeSend(bridgeWs, payload);
        }
    }, Math.max(1, bridgeSymbolsRefreshSec) * 1000);

    const heartbeatInterval = setInterval(() => {
        for (const [ws] of clients.entries()) {
            if (ws.readyState !== ws.OPEN) continue;
            if (ws.isAlive === false) {
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            try {
                ws.ping();
            } catch {
                ws.terminate();
            }
        }
    }, Math.max(5000, heartbeatIntervalMs));

    const router = setupMessageRouter(clients, mt5Prices, subscriptionIndex);

    wss.on("connection", async (ws, request) => {
        const authContext = await resolveAuthContext(request, queryAuthPolicy);
        if (!authContext) {
            emitWsError(ws, { code: "unauthorized" });
            ws.close(1008, "Unauthorized");
            return;
        }

        if (clients.size >= maxClients) {
            ws.close(1008, "Too many clients");
            return;
        }

        clients.set(ws, {
            userId: authContext.type === "user" ? authContext.userId : null,
            role: authContext.type === "user" ? authContext.role : null,
            authType: authContext.type,
            authVia: authContext.via || "unknown",
            isServiceAuth: authContext.type === "service",
            symbols: [],
            charts: new Set(),
            msgCount: 0,
            msgWindowStart: Date.now(),
            isBridgeLike: false,
            isBridgeAuthenticated: false,
        });
        ws.isAlive = true;
        addDefaultPriceClient(subscriptionIndex, ws);
        setWsClients(clients.size);
        if (!clients.get(ws)?.isBridgeAuthenticated) {
            safeSend(ws, JSON.stringify({ topic: "bridgeStatus", online: runtimeState.bridgeOnline }));
        }

        ws.on("pong", () => {
            ws.isAlive = true;
        });

        ws.on("message", (msg) => {
            const meta = clients.get(ws);
            if (!meta) return;

            try {
                const parsed = JSON.parse(msg.toString());
                const topic = parsed.topic || parsed.type || parsed.event || "";
                if (typeof topic === "string" && BRIDGE_TOPICS.has(topic)) {
                    if (!meta.isServiceAuth) {
                        emitWsError(ws, { code: "forbidden", detail: "bridge_topic_requires_service_auth" });
                        logWarn("ws.bridge_topic.forbidden", { topic, auth_type: meta.authType, role: meta.role || null });
                        ws.close(1008, "Forbidden");
                        return;
                    }
                    meta.isBridgeLike = true;
                    if (!meta.isBridgeAuthenticated) {
                        meta.isBridgeAuthenticated = true;
                        ws.isBridgeAuthenticated = true;
                        removeClientFromIndexes(subscriptionIndex, ws);
                        logInfo("ws.bridge.authenticated", { via: meta.authVia || "unknown" });
                    }
                }
            } catch {
                // Non-JSON frames are ignored for role detection.
            }

            const now = Date.now();
            if (now - meta.msgWindowStart > windowMs) {
                meta.msgWindowStart = now;
                meta.msgCount = 0;
            }
            meta.msgCount += 1;

            const allowedRate = meta.isBridgeAuthenticated ? bridgeMsgRate : msgRate;
            if (meta.msgCount > allowedRate) {
                const role = meta.isBridgeAuthenticated ? "bridge-authenticated" : "client";
                logWarn("ws.rate_limit.exceeded", {
                    role,
                    msg_count: meta.msgCount,
                    allowed_rate: allowedRate,
                    window_ms: windowMs,
                });
                incrementWsDroppedRateLimit();
                ws.close(1008, "Rate limit exceeded");
                return;
            }

            router(ws, msg);
        });

        ws.on("close", (code, reason) => {
            const closedMeta = clients.get(ws);
            if (closedMeta?.isBridgeAuthenticated) {
                const reasonText = typeof reason === "string" ? reason : Buffer.from(reason || []).toString();
                logInfo("ws.bridge.disconnected", { code, reason: reasonText || "n/a" });
                setBridgeOnline(false);
                broadcastBridgeStatus(false);
            }
            clients.delete(ws);
            removeClientFromIndexes(subscriptionIndex, ws);
            setWsClients(clients.size);
        });
    });

    wss.on("close", () => {
        clearInterval(heartbeatInterval);
    });

    return wss;
}

function broadcastBridgeStatus(online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online });
    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload);
        }
    }
}

function broadcastBinanceState() {
    const payload = JSON.stringify({
        topic: "binance_positions_update",
        account: binanceSimulator.getAccount(),
        positions: binanceSimulator.getPositions(),
        history: binanceSimulator.getHistory(),
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload, { nonCritical: true });
        }
    }
}
