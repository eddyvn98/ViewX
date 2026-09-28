import { broadcastCandleForSymbol } from "../services/broadcastService.js";
import { setBridgeOnline } from "../../runtime-state.js";
import { safeSend } from "../wsSend.js";
import { isRecipientForMt5Scope, resolveBridgeMt5Scope, setScopedMt5Price, scopeMetadata } from "../mt5Scope.js";

const dailyOpens = new Map();

export function handleMt5Update({ ws, clients, mt5Prices, subscriptionIndex }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const mt5Scope = resolveBridgeMt5Scope(senderMeta);

    const normalizedSymbol = (data.symbol || "").replace(/[mM]$/, "m");
    const upperSymbol = String(normalizedSymbol || "").toUpperCase();

    // Reserved VN gold symbols must come from VN_GOLD pipeline, never MT5 ticks.
    if (upperSymbol === "SJCVN" || upperSymbol === "DOJIVN") {
        return;
    }

    let openPrice = data.daily_open;

    if (!openPrice) {
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const openPrefix = `${mt5Scope.scopeId}|${normalizedSymbol}|`;
        const openKey = `${openPrefix}${todayStr}`;

        if (!dailyOpens.has(openKey)) {
            for (const key of dailyOpens.keys()) {
                if (key.startsWith(openPrefix)) dailyOpens.delete(key);
            }
            dailyOpens.set(openKey, data.price);
        }
        openPrice = dailyOpens.get(openKey);
    }

    const changeValue = data.price - openPrice;
    const changePercent = openPrice && openPrice !== 0 ? (changeValue / openPrice) * 100 : 0;

    const scopedPrice = setScopedMt5Price(mt5Prices, mt5Scope, {
        symbol: normalizedSymbol,
        price: data.price,
        ask: data.ask,
        changeValue,
        change: changePercent,
        source: mt5Scope.source,
        serverTime: data.time,
    });
    if (!scopedPrice) return;

    if (!senderMeta.bridgeStatusAnnounced) {
        senderMeta.bridgeStatusAnnounced = true;
        setBridgeOnline(true);
        console.log("[WS] MT5 Bridge connected.");
        broadcastBridgeStatus(clients, mt5Scope, true);
    }

    const payload = JSON.stringify({ topic: "priceUpdate", data: [scopedPrice] });
    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Scope(meta, mt5Scope)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload, { nonCritical: true });
        }
    }

    broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, normalizedSymbol, mt5Scope);
}

function broadcastBridgeStatus(clients, mt5Scope, online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online, mt5_scope: scopeMetadata(mt5Scope) });
    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Scope(meta, mt5Scope)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload);
        }
    }
}
