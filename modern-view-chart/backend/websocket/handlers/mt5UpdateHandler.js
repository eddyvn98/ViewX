import { broadcastCandleForSymbol } from "../services/broadcastService.js";

const dailyOpens = new Map();

export function handleMt5Update({ ws, clients, mt5Prices }, data) {
    const normalizedSymbol = (data.symbol || "").replace(/[mM]$/, 'm');

    // Simple daily open tracking: if not exists or different day, set it
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const openKey = `${normalizedSymbol}_${todayStr}`;

    if (!dailyOpens.has(openKey)) {
        // Clear old entries for this symbol
        for (const key of dailyOpens.keys()) {
            if (key.startsWith(normalizedSymbol)) dailyOpens.delete(key);
        }
        dailyOpens.set(openKey, data.price);
    }

    const openPrice = dailyOpens.get(openKey);
    const changeValue = data.price - openPrice;
    const changePercent = openPrice !== 0 ? (changeValue / openPrice) * 100 : 0;

    mt5Prices.set(normalizedSymbol, {
        symbol: normalizedSymbol,
        price: data.price,
        ask: data.ask,
        changeValue: changeValue,
        change: changePercent,
        source: 'MT5',
        serverTime: data.time
    });

    if (!ws.isBridge) {
        ws.isBridge = true;
        console.log("✅ MT5 Bridge Connected!");
        broadcastBridgeStatus(clients, true);
    }

    const payload = JSON.stringify({ topic: "priceUpdate", data: [mt5Prices.get(normalizedSymbol)] });
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }

    broadcastCandleForSymbol({ clients, mt5Prices }, normalizedSymbol, data.price);
}

function broadcastBridgeStatus(clients, online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online });
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
