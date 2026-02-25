import { WebSocketServer } from "ws";
import { setupMessageRouter } from "./messageRouter.js";
import { broadcastPricesToSubscribers, broadcastChartCandles } from "./services/broadcastService.js";
import { startBinanceTickerStream } from "./services/binanceTickerService.js";
import { binanceSimulator } from "../services/binanceSimulator.js";
import {
    incrementWsDroppedRateLimit,
    recordBroadcastLoopDuration,
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

export const clients = new Map();
export const mt5Prices = new Map();

function isAuthorizedRequest(request) {
    const expectedToken = (process.env.ACCESS_TOKEN || "").trim();
    if (!expectedToken) return false;

    const bearerCredential = extractBearerCredential(request.headers?.authorization || "");

    const protocolHeader = request.headers?.["sec-websocket-protocol"] || "";
    const protocolTokens = String(protocolHeader)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    for (const protocolToken of protocolTokens) {
        if (protocolToken.startsWith("bearer.")) {
            const protocolValue = protocolToken.slice("bearer.".length);
            if (
                isAuthorizedWithCredential({
                    expectedToken,
                    bearerCredential: protocolValue,
                })
            ) {
                return true;
            }
        }
    }

    const parsed = new URL(request.url || "/", "http://localhost");
    return isAuthorizedWithCredential({
        expectedToken,
        bearerCredential,
        queryAccessToken: (parsed.searchParams.get("access_token") || "").trim(),
        queryAccessTicket: (parsed.searchParams.get("access_ticket") || "").trim(),
    });
}

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

export default function initWebSocket(server) {
    const maxClients = Number.parseInt(process.env.MAX_WS_CLIENTS || "150", 10);
    const msgRate = Number.parseInt(process.env.WS_MSG_RATE_PER_10S || "60", 10);
    const bridgeMsgRate = Number.parseInt(process.env.BRIDGE_WS_MSG_RATE_PER_10S || "15000", 10);
    const bridgeSymbolsRefreshSec = Number.parseInt(process.env.BRIDGE_SYMBOL_REFRESH_SEC || "2", 10);
    const heartbeatIntervalMs = Number.parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || "30000", 10);
    const windowMs = 10_000;

    const wss = new WebSocketServer({
        server,
        maxPayload: 10 * 1024 * 1024,
    });
    const subscriptionIndex = createSubscriptionIndex();

    startBinanceTickerStream();

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
    }, 1000);

    setInterval(() => {
        binanceSimulator.updatePnL();
        broadcastBinanceState();
    }, 1000);

    let lastInterestHash = "";
    setInterval(() => {
        const bridgeSockets = [];
        for (const [ws, meta] of clients.entries()) {
            if (meta?.isBridgeLike && ws.readyState === ws.OPEN) bridgeSockets.push(ws);
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

    wss.on("connection", (ws, request) => {
        if (!isAuthorizedRequest(request)) {
            ws.close(1008, "Unauthorized");
            return;
        }

        if (clients.size >= maxClients) {
            ws.close(1008, "Too many clients");
            return;
        }

        clients.set(ws, {
            userId: null,
            symbols: [],
            charts: new Set(),
            msgCount: 0,
            msgWindowStart: Date.now(),
            isBridgeLike: false,
        });
        ws.isAlive = true;
        addDefaultPriceClient(subscriptionIndex, ws);
        setWsClients(clients.size);

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
                    meta.isBridgeLike = true;
                    ws.isBridge = true;
                    removeClientFromIndexes(subscriptionIndex, ws);
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

            const allowedRate = meta.isBridgeLike ? bridgeMsgRate : msgRate;
            if (meta.msgCount > allowedRate) {
                const role = meta.isBridgeLike ? "bridge-like" : "client";
                console.warn(`[WS] Rate limit exceeded for ${role} socket (${meta.msgCount}/${allowedRate} in ${windowMs}ms)`);
                incrementWsDroppedRateLimit();
                ws.close(1008, "Rate limit exceeded");
                return;
            }

            router(ws, msg);
        });

        ws.on("close", (code, reason) => {
            if (ws.isBridge) {
                const reasonText = typeof reason === "string" ? reason : Buffer.from(reason || []).toString();
                console.log(`[WS] MT5 Bridge disconnected. code=${code} reason=${reasonText || "n/a"}`);
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
        if (meta?.isBridgeLike) continue;
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
        if (meta?.isBridgeLike) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload, { nonCritical: true });
        }
    }
}
