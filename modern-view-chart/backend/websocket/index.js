import { WebSocketServer } from "ws";
import { setupMessageRouter } from "./messageRouter.js";
import { broadcastPricesToSubscribers, broadcastChartCandles } from "./services/broadcastService.js";
import { startBinanceTickerStream } from "./services/binanceTickerService.js";
import { binanceSimulator } from "../services/binanceSimulator.js";
import { setBridgeOnline, setWsClients } from "../runtime-state.js";

export const clients = new Map();
export const mt5Prices = new Map();

function parseCoreSymbols() {
    const fromEnv = (process.env.CORE_SYMBOLS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (fromEnv.length > 0) return fromEnv;
    return ["XAUUSDm", "BTCUSDm", "ETHUSDm", "EURUSDm", "GBPUSDm"];
}

const CORE_SYMBOLS = parseCoreSymbols();

function normalizeSymbol(symbol) {
    if (typeof symbol !== "string") return "";
    const trimmed = symbol.trim();
    if (!trimmed) return "";
    if (trimmed.toUpperCase().includes("USDT")) return trimmed.toUpperCase();
    if (/[mM]$/.test(trimmed)) return trimmed.replace(/[mM]$/, "m");
    return trimmed;
}

function isAuthorizedRequest(request) {
    const expectedToken = (process.env.ACCESS_TOKEN || "").trim();
    if (!expectedToken) return false;
    const parsed = new URL(request.url || "/", "http://localhost");
    const incoming = (parsed.searchParams.get("access_token") || "").trim();
    return incoming === expectedToken;
}

function collectClientInterestSymbols() {
    const collected = new Set();

    for (const [ws, meta] of clients.entries()) {
        if (meta?.isBridgeLike) continue;
        if (ws.readyState !== ws.OPEN) continue;

        for (const symbol of meta?.symbols || []) {
            const normalized = normalizeSymbol(symbol);
            if (normalized) collected.add(normalized);
        }

        for (const chartKey of meta?.charts || []) {
            const [symbol] = String(chartKey).split("|");
            const normalized = normalizeSymbol(symbol);
            if (normalized) collected.add(normalized);
        }
    }

    if (collected.size === 0) {
        return CORE_SYMBOLS.map((s) => normalizeSymbol(s)).filter(Boolean);
    }

    return Array.from(collected);
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
    const maxClients = Number.parseInt(process.env.MAX_WS_CLIENTS || "80", 10);
    const msgRate = Number.parseInt(process.env.WS_MSG_RATE_PER_10S || "60", 10);
    const bridgeMsgRate = Number.parseInt(process.env.BRIDGE_WS_MSG_RATE_PER_10S || "15000", 10);
    const bridgeSymbolsRefreshSec = Number.parseInt(process.env.BRIDGE_SYMBOL_REFRESH_SEC || "2", 10);
    const windowMs = 10_000;

    const wss = new WebSocketServer({
        server,
        maxPayload: 10 * 1024 * 1024,
    });

    startBinanceTickerStream();

    setInterval(() => broadcastPricesToSubscribers({ clients, mt5Prices }), 1000);
    setInterval(() => broadcastChartCandles({ clients, mt5Prices }), 1000);

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

        const symbols = collectClientInterestSymbols();
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
            bridgeWs.send(payload);
        }
    }, Math.max(1, bridgeSymbolsRefreshSec) * 1000);

    const router = setupMessageRouter(clients, mt5Prices);

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
        setWsClients(clients.size);

        ws.on("message", (msg) => {
            const meta = clients.get(ws);
            if (!meta) return;

            try {
                const parsed = JSON.parse(msg.toString());
                const topic = parsed.topic || parsed.type || parsed.event || "";
                if (typeof topic === "string" && BRIDGE_TOPICS.has(topic)) {
                    meta.isBridgeLike = true;
                    ws.isBridge = true;
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
            setWsClients(clients.size);
        });
    });

    return wss;
}

function broadcastBridgeStatus(online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online });
    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeLike) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
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
            clientWs.send(payload);
        }
    }
}
