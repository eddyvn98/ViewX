import { WebSocketServer } from "ws";
import { setupMessageRouter } from "./messageRouter.js";
import { broadcastPricesToSubscribers, broadcastChartCandles } from "./services/broadcastService.js";

export const clients = new Map();
export const mt5Prices = new Map();

import { startBinanceTickerStream } from "./services/binanceTickerService.js";
import { binanceSimulator } from "../services/binanceSimulator.js";
import { clients as globalClients } from "./index.js";

export default function initWebSocket(server) {
    const wss = new WebSocketServer({
        server,
        maxPayload: 10 * 1024 * 1024 // 10MB
    });

    // Start Real-time Binance Ticker Stream for Market List
    startBinanceTickerStream();

    setInterval(() => broadcastPricesToSubscribers({ clients, mt5Prices }), 1000); // Speed up to 1s
    setInterval(() => broadcastChartCandles({ clients, mt5Prices }), 1000);

    // Binance Simulator Loop
    setInterval(() => {
        binanceSimulator.updatePnL();
        broadcastBinanceState();
    }, 1000);

    const router = setupMessageRouter(clients, mt5Prices);

    wss.on("connection", (ws) => {
        clients.set(ws, { userId: null, symbols: [], charts: new Set() });

        ws.on("message", (msg) => router(ws, msg));

        ws.on("close", () => {
            if (ws.isBridge) {
                console.log("❌ MT5 Bridge Disconnected!");
                broadcastBridgeStatus(false);
            }
            clients.delete(ws);
        });
    });

    return wss;
}

function broadcastBridgeStatus(online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online });
    for (const [clientWs] of globalClients.entries()) {
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
        history: binanceSimulator.getHistory()
    });

    for (const [clientWs] of globalClients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
