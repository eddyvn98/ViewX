import { WebSocketServer } from "ws";
import { clients } from "./state.js";
import { handleMessage, broadcastBridgeStatus } from "./handlers.js";
import { broadcastPricesToSubscribers, broadcastChartCandles } from "./broadcaster.js";

export default function initWebSocket(server) {
    const wss = new WebSocketServer({ server });

    setInterval(broadcastPricesToSubscribers, 3000);
    setInterval(broadcastChartCandles, 3000);

    wss.on("connection", (ws) => {
        clients.set(ws, { userId: null, symbols: [], chart: null });

        ws.on("message", (msg) => {
            try {
                const data = JSON.parse(msg.toString());
                handleMessage(ws, data);
            } catch (err) {
                console.error("❌ WS parse error:", err.message);
            }
        });

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
