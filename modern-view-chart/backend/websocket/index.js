import { WebSocketServer } from "ws";
import { setupMessageRouter } from "./messageRouter.js";
import { startBinanceTickerStream } from "./services/binanceTickerService.js";
import { emergencyConfig } from "../config/emergency.js";
import {
    incrementWsDroppedRateLimit,
    runtimeState,
    setBridgeOnline,
    setWsClients,
} from "../runtime-state.js";
import { safeSend } from "./wsSend.js";
import { addDefaultPriceClient, createSubscriptionIndex, removeClientFromIndexes } from "./subscriptionIndex.js";
import { logInfo, logWarn } from "../logger.js";
import { BRIDGE_TOPICS, resolveQueryAuthPolicy } from "./config.js";
import { emitWsError, resolveAuthContext } from "./auth.js";
import { startPeriodicTasks } from "./loopManager.js";
import { bridgeRegistry } from "./bridgeRegistry.js";
import { onModuleActivated } from "../services/moduleEvents.js";
import { getModuleEntitlementReason, hasRequiredModule } from "./services/proEntitlementGuard.js";

export const clients = new Map();
export const mt5Prices = new Map();

function normalizeMetaValue(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function canPublishBridgeTopic(topic, meta, payload) {
    if (!topic || !BRIDGE_TOPICS.has(topic)) return { allowed: true, reason: null };
    if (meta?.isServiceAuth) return { allowed: true, reason: null };
    if (meta?.authType !== "user") {
        return { allowed: false, reason: "bridge_topic_requires_authenticated_user_or_service" };
    }
    if (hasRequiredModule("mt5_trade", meta, payload)) {
        return { allowed: true, reason: null };
    }
    return {
        allowed: false,
        reason: getModuleEntitlementReason("mt5_trade", meta, payload) || "module_required:mt5_trade",
    };
}

export default function initWebSocket(server) {
    const maxClients = emergencyConfig.limits.wsClients;
    const msgRate = emergencyConfig.limits.wsMsgPer10s;
    const bridgeMsgRate = emergencyConfig.limits.bridgeWsMsgPer10s;
    const bridgeSymbolsRefreshSec = Number.parseInt(process.env.BRIDGE_SYMBOL_REFRESH_SEC || "2", 10);
    const heartbeatIntervalMs = Number.parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || "30000", 10);
    const wsBroadcastIntervalMs = emergencyConfig.limits.wsBroadcastIntervalMs;
    const binanceBroadcastIntervalMs = emergencyConfig.limits.binanceBroadcastIntervalMs;
    const queryAuthPolicy = resolveQueryAuthPolicy();
    const windowMs = 10_000;

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

    const stopPeriodicTasks = startPeriodicTasks({
        clients,
        mt5Prices,
        subscriptionIndex,
        wsBroadcastIntervalMs,
        binanceBroadcastIntervalMs,
        bridgeSymbolsRefreshSec,
        heartbeatIntervalMs,
    });

    const router = setupMessageRouter(clients, mt5Prices, subscriptionIndex);
    const disposeModuleActivated = onModuleActivated((event) => {
        const userId = String(event?.userId || "").trim();
        if (!userId) return;
        const payload = JSON.stringify({
            topic: "module_access_updated",
            module: event?.module || null,
            orderCode: event?.orderCode || null,
            source: event?.source || null,
            updatedAt: Date.now(),
        });
        for (const [clientWs, meta] of clients.entries()) {
            if (String(meta?.userId || "").trim() !== userId) continue;
            if (clientWs.readyState === clientWs.OPEN) {
                safeSend(clientWs, payload);
            }
        }
    });

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
            plan: authContext.type === "user" ? normalizeMetaValue(authContext.plan || "free") : null,
            modules: authContext.type === "user" && Array.isArray(authContext.modules) ? authContext.modules : [],
            subscription: authContext.type === "user" ? authContext.subscription || null : null,
            moduleAccess: authContext.type === "user" && Array.isArray(authContext.moduleAccess) ? authContext.moduleAccess : [],
            accountId: normalizeMetaValue(authContext.accountId || authContext.account_id),
            accountLogin: null,
            terminalId: null,
            extensionVersion: null,
            bridgeVersion: null,
            protocolVersion: null,
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
        bridgeRegistry.register(ws, {
            userId: authContext.type === "user" ? authContext.userId : null,
            accountId: authContext.accountId || authContext.account_id || null,
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
                const nextUserId = normalizeMetaValue(parsed.userId || parsed.user_id);
                const nextAccountId = normalizeMetaValue(
                    parsed.accountId ||
                    parsed.account_id ||
                    parsed.accountLogin ||
                    parsed.account_login,
                );
                const nextAccountLogin = normalizeMetaValue(parsed.accountLogin || parsed.account_login);
                const nextTerminalId = normalizeMetaValue(
                    parsed.terminalId ||
                    parsed.terminal_id ||
                    parsed.terminal ||
                    parsed.bridgeId ||
                    parsed.bridge_id,
                );
                const nextExtensionVersion = normalizeMetaValue(
                    parsed.extensionVersion ||
                    parsed.extension_version ||
                    parsed.bridgeVersion ||
                    parsed.bridge_version,
                );
                const nextBridgeVersion = normalizeMetaValue(
                    parsed.bridgeVersion ||
                    parsed.bridge_version ||
                    parsed.extensionVersion ||
                    parsed.extension_version,
                );
                const nextProtocolVersion = normalizeMetaValue(parsed.protocolVersion || parsed.protocol_version);
                if (nextUserId) meta.userId = nextUserId;
                if (nextAccountId) meta.accountId = nextAccountId;
                if (nextAccountLogin) meta.accountLogin = nextAccountLogin;
                if (nextTerminalId) meta.terminalId = nextTerminalId;
                if (nextExtensionVersion) meta.extensionVersion = nextExtensionVersion;
                if (nextBridgeVersion) meta.bridgeVersion = nextBridgeVersion;
                if (nextProtocolVersion) meta.protocolVersion = nextProtocolVersion;

                if (typeof topic === "string" && BRIDGE_TOPICS.has(topic)) {
                    const bridgeAuthCheck = canPublishBridgeTopic(topic, meta, parsed);
                    if (!bridgeAuthCheck.allowed) {
                        emitWsError(ws, { code: "forbidden", detail: bridgeAuthCheck.reason || "bridge_topic_forbidden" });
                        logWarn("ws.bridge_topic.forbidden", {
                            topic,
                            auth_type: meta.authType,
                            role: meta.role || null,
                            reason: bridgeAuthCheck.reason || null,
                            plan: meta.plan || null,
                            modules: meta.modules || null,
                        });
                        ws.close(1008, "Forbidden");
                        return;
                    }
                    meta.isBridgeLike = true;
                    if (!meta.isBridgeAuthenticated) {
                        meta.isBridgeAuthenticated = true;
                        ws.isBridgeAuthenticated = true;
                        removeClientFromIndexes(subscriptionIndex, ws);
                        logInfo("ws.bridge.authenticated", {
                            via: meta.authVia || "unknown",
                            auth_type: meta.authType || "unknown",
                            role: meta.role || null,
                        });
                    }
                    bridgeRegistry.register(ws, meta);
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
            bridgeRegistry.unregister(ws);
            clients.delete(ws);
            removeClientFromIndexes(subscriptionIndex, ws);
            setWsClients(clients.size);
        });
    });

    wss.on("close", () => {
        stopPeriodicTasks();
        disposeModuleActivated();
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
