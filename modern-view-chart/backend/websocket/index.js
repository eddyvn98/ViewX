import { WebSocketServer } from "ws";
import { setupMessageRouter } from "./messageRouter.js";
import { startBinanceTickerStream } from "./services/binanceTickerService.js";
import { emergencyConfig } from "../config/emergency.js";
import {
    incrementWsDroppedRateLimit,
    setBridgeOnline,
    setBridgeRegistered,
    setWsClients,
} from "../runtime-state.js";
import { safeSend } from "./wsSend.js";
import { addDefaultPriceClient, createSubscriptionIndex, removeClientFromIndexes } from "./subscriptionIndex.js";
import { logInfo, logWarn } from "../logger.js";
import { BRIDGE_TOPICS, resolveQueryAuthPolicy } from "./config.js";
import { emitWsError, resolveAuthContext } from "./auth.js";
import { startPeriodicTasks } from "./loopManager.js";
import { getDefaultClientMode, isBridgeClientMode } from "./clientMode.js";
import { createBridgeRegistry } from "./bridgeRegistry.js";
import {
    clearScopedMt5Prices,
    clearScopedMt5State,
    clearScopedMt5Symbols,
    isRecipientForMt5Scope,
    resolveBridgeMt5Scope,
    resolveClientMt5Scope,
    scopeMetadata,
} from "./mt5Scope.js";
import { buildAvailableMt5Accounts, resolveClientMt5Bridge } from "./mt5AccountCatalog.js";

export const clients = new Map();
export const mt5Prices = new Map();

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
    const bridgeRegistry = createBridgeRegistry();

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

    const router = setupMessageRouter(clients, mt5Prices, subscriptionIndex, bridgeRegistry);

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
            accountTier: authContext.type === "user" ? authContext.accountTier : authContext.type === "guest" ? "free" : null,
            authType: authContext.type,
            authVia: authContext.via || "unknown",
            clientMode: getDefaultClientMode(authContext),
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
            const clientMeta = clients.get(ws);
            const selectedScope = resolveClientMt5Scope(clientMeta);
            const route = resolveClientMt5Bridge(clientMeta, bridgeRegistry);
            safeSend(
                ws,
                JSON.stringify({
                    topic: "bridgeStatus",
                    online: Boolean(route.record),
                    mt5_scope: scopeMetadata(selectedScope),
                })
            );
        }

        ws.on("pong", () => {
            ws.isAlive = true;
            bridgeRegistry.touch(ws);
        });

        ws.on("message", (msg) => {
            const meta = clients.get(ws);
            if (!meta) return;
            bridgeRegistry.touch(ws);

            try {
                const parsed = JSON.parse(msg.toString());
                const topic = parsed.topic || parsed.type || parsed.event || "";
                if (typeof topic === "string" && BRIDGE_TOPICS.has(topic)) {
                    if (!isBridgeClientMode(meta.clientMode)) {
                        emitWsError(ws, { code: "forbidden", detail: "bridge_topic_requires_bridge_client_mode" });
                        logWarn("ws.bridge_topic.forbidden", {
                            topic,
                            auth_type: meta.authType,
                            role: meta.role || null,
                            account_tier: meta.accountTier || null,
                            client_mode: meta.clientMode || null,
                        });
                        ws.close(1008, "Forbidden");
                        return;
                    }
                    meta.isBridgeLike = true;
                    if (!meta.isBridgeAuthenticated) {
                        meta.isBridgeAuthenticated = true;
                        ws.isBridgeAuthenticated = true;
                        removeClientFromIndexes(subscriptionIndex, ws);
                        const registration = bridgeRegistry.register(ws, meta);
                        setBridgeRegistered(bridgeRegistry.size());
                        setBridgeOnline(bridgeRegistry.size() > 0);
                        const mt5Scope = resolveBridgeMt5Scope(meta);
                        meta.bridgeStatusAnnounced = true;
                        broadcastBridgeStatus(mt5Scope, true, bridgeRegistry);
                        broadcastMt5AccountsAvailable(mt5Scope.ownerUserId, bridgeRegistry);
                        logInfo("ws.bridge.authenticated", {
                            via: meta.authVia || "unknown",
                            client_mode: meta.clientMode || null,
                            account_tier: meta.accountTier || null,
                            owner_user_id: mt5Scope.ownerUserId,
                            account_login: registration?.record?.accountLogin || null,
                            terminal_id: registration?.record?.terminalId || null,
                            replaced_existing: Boolean(registration?.replaced),
                        });
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
                const mt5Scope = resolveBridgeMt5Scope(closedMeta);
                const removed = bridgeRegistry.unregister(ws);
                const replacementRoute = bridgeRegistry.resolve({
                    userId: mt5Scope.ownerUserId,
                    accountLogin: mt5Scope.accountLogin,
                    terminalId: mt5Scope.terminalId,
                });
                const sameScopeStillOnline = Boolean(replacementRoute.record);
                setBridgeRegistered(bridgeRegistry.size());
                setBridgeOnline(bridgeRegistry.size() > 0);
                const reasonText = typeof reason === "string" ? reason : Buffer.from(reason || []).toString();
                logInfo("ws.bridge.disconnected", {
                    code,
                    reason: reasonText || "n/a",
                    owner_user_id: mt5Scope.ownerUserId,
                    account_login: mt5Scope.accountLogin,
                    terminal_id: mt5Scope.terminalId,
                    scope_still_online: sameScopeStillOnline,
                    registry_removed: Boolean(removed),
                });
                if (removed && !sameScopeStillOnline) {
                    clearScopedMt5Prices(mt5Prices, mt5Scope);
                    clearScopedMt5State(mt5Scope);
                    clearScopedMt5Symbols(mt5Scope);
                }
                broadcastBridgeStatus(mt5Scope, sameScopeStillOnline, bridgeRegistry);
                broadcastMt5AccountsAvailable(mt5Scope.ownerUserId, bridgeRegistry);
            }
            clients.delete(ws);
            removeClientFromIndexes(subscriptionIndex, ws);
            setWsClients(clients.size);
        });
    });

    wss.on("close", () => {
        stopPeriodicTasks();
    });

    return wss;
}

function broadcastBridgeStatus(mt5Scope, online, bridgeRegistry = null) {
    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeAuthenticated) continue;
        if (!isRecipientForMt5Scope(meta, mt5Scope)) continue;
        if (clientWs.readyState !== clientWs.OPEN) continue;

        const effectiveOnline = bridgeRegistry
            ? Boolean(resolveClientMt5Bridge(meta, bridgeRegistry).record)
            : online;
        safeSend(clientWs, JSON.stringify({
            topic: "bridgeStatus",
            online: effectiveOnline,
            mt5_scope: scopeMetadata(resolveClientMt5Scope(meta)),
        }));
    }
}

function broadcastMt5AccountsAvailable(ownerUserId, bridgeRegistry) {
    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeAuthenticated) continue;
        if (ownerUserId && String(meta?.userId || "") !== String(ownerUserId)) continue;
        if (clientWs.readyState !== clientWs.OPEN) continue;

        safeSend(clientWs, JSON.stringify({
            topic: "mt5_accounts_available",
            accounts: buildAvailableMt5Accounts(meta, bridgeRegistry),
            selected: scopeMetadata(resolveClientMt5Scope(meta)),
        }));
    }
}
