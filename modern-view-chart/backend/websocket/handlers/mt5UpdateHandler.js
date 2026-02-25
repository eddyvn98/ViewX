import { broadcastCandleForSymbol } from "../services/broadcastService.js";
import { setBridgeOnline } from "../../runtime-state.js";
import { safeSend } from "../wsSend.js";

const dailyOpens = new Map();

export function handleMt5Update({ ws, clients, mt5Prices, subscriptionIndex }, data) {
    const normalizedSymbol = (data.symbol || "").replace(/[mM]$/, "m");

    let openPrice = data.daily_open;

    if (!openPrice) {
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const openKey = `${normalizedSymbol}_${todayStr}`;

        if (!dailyOpens.has(openKey)) {
            for (const key of dailyOpens.keys()) {
                if (key.startsWith(normalizedSymbol)) dailyOpens.delete(key);
            }
            dailyOpens.set(openKey, data.price);
        }
        openPrice = dailyOpens.get(openKey);
    }

    const changeValue = data.price - openPrice;
    const changePercent = openPrice && openPrice !== 0 ? (changeValue / openPrice) * 100 : 0;

    mt5Prices.set(normalizedSymbol, {
        symbol: normalizedSymbol,
        price: data.price,
        ask: data.ask,
        changeValue,
        change: changePercent,
        source: "MT5",
        serverTime: data.time,
    });

    if (!ws.isBridge) {
        ws.isBridge = true;
        setBridgeOnline(true);
        console.log("[WS] MT5 Bridge connected.");
        broadcastBridgeStatus(clients, true);
    }

    const payload = JSON.stringify({ topic: "priceUpdate", data: [mt5Prices.get(normalizedSymbol)] });
    for (const [clientWs] of clients.entries()) {
        if (!clientWs.isBridge && clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload, { nonCritical: true });
        }
    }

    broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, normalizedSymbol, data.price);
}

function broadcastBridgeStatus(clients, online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online });
    for (const [clientWs] of clients.entries()) {
        if (!clientWs.isBridge && clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload);
        }
    }
}
