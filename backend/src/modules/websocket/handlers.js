import { clients, mt5Prices, candleBuffers } from "./state.js";

export function handleMessage(ws, data) {
    const clientInfo = clients.get(ws);

    // Detect Bridge
    if ((data.type === "mt5_update" || data.type === "mt5_positions_update") && !ws.isBridge) {
        ws.isBridge = true;
        console.log("✅ MT5 Bridge Connected!");
        broadcastBridgeStatus(true);
    }

    if (data.type === "auth") {
        clientInfo.userId = data.userId || null;
        if (global.lastMt5State) {
            ws.send(JSON.stringify({
                type: "mt5_positions_update",
                account: global.lastMt5State.account,
                positions: global.lastMt5State.positions,
                orders: global.lastMt5State.orders || []
            }));
        }
    }

    if (data.type === "subscribeCandle") {
        clientInfo.chart = { symbol: data.symbol, interval: data.interval };
        if (data.candles && Array.isArray(data.candles)) {
            const key = `${data.symbol}|${data.interval}`;
            candleBuffers[key] = data.candles.map(c => ({ time: c.time, close: c.close }));
        }
    }

    if (data.type === "mt5_update") {
        mt5Prices.set(data.symbol, { symbol: data.symbol, price: data.price, ask: data.ask, change: 0, time: data.time });
        const payload = JSON.stringify({ type: "priceUpdate", data: [mt5Prices.get(data.symbol)] });
        broadcastToClients(payload);
    }

    if (data.type === "mt5_positions_update") {
        global.lastMt5State = { account: data.account, positions: data.positions, orders: data.orders || [] };
        const payload = JSON.stringify({ type: "mt5_positions_update", ...global.lastMt5State });
        broadcastToClients(payload);
    }

    if (data.type === "mt5_candles") {
        const payload = JSON.stringify(data);
        broadcastToClients(payload, true); // Only non-bridge
    }

    if (data.type === "mt5_command") {
        broadcastToClients(JSON.stringify(data)); // Broadcast to bridge (and others, bridge will filter)
    }
}

export function broadcastBridgeStatus(online) {
    const payload = JSON.stringify({ type: "bridgeStatus", online });
    broadcastToClients(payload);
}

function broadcastToClients(payload, excludeBridge = false) {
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            if (excludeBridge && clientWs.isBridge) continue;
            clientWs.send(payload);
        }
    }
}
