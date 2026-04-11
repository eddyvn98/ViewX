import { broadcastCandleForSymbol } from "../services/broadcastService.js";
import { setBridgeOnline } from "../../runtime-state.js";
import { safeSend } from "../wsSend.js";
import { isRecipientForMt5Owner, resolveBridgeOwnerUserId, setScopedMt5Price } from "../mt5Scope.js";

const dailyOpens = new Map();

export function handleMt5Update({ ws, clients, mt5Prices, subscriptionIndex }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const ownerUserId = resolveBridgeOwnerUserId(senderMeta);

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

    const scopedPrice = setScopedMt5Price(mt5Prices, ownerUserId, {
        symbol: normalizedSymbol,
        price: data.price,
        ask: data.ask,
        changeValue,
        change: changePercent,
        source: "MT5",
        serverTime: data.time,
    });
    if (!scopedPrice) return;

    if (!senderMeta.bridgeStatusAnnounced) {
        senderMeta.bridgeStatusAnnounced = true;
        setBridgeOnline(true);
        console.log("[WS] MT5 Bridge connected.");
        broadcastBridgeStatus(clients, ownerUserId, true);
    }

    const payload = JSON.stringify({ topic: "priceUpdate", data: [scopedPrice] });
    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Owner(meta, ownerUserId)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload, { nonCritical: true });
        }
    }

    broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, normalizedSymbol, ownerUserId);
}

function broadcastBridgeStatus(clients, ownerUserId, online) {
    const payload = JSON.stringify({ topic: "bridgeStatus", online });
    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Owner(meta, ownerUserId)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload);
        }
    }
}
