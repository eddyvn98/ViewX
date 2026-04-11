import { logInfo } from "../../logger.js";
import { isRecipientForMt5Owner, resolveBridgeOwnerUserId } from "../mt5Scope.js";
import { candleBuffers } from "./subscribeHandler.js";

export function handleMt5Candles({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const ownerUserId = resolveBridgeOwnerUserId(senderMeta);
    const payload = JSON.stringify(data);
    let delivered = 0;
    for (const [clientWs, metadata] of clients.entries()) {
        if (!isRecipientForMt5Owner(metadata, ownerUserId)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
            delivered += 1;
        }
    }
    if (Array.isArray(data?.candles)) {
        const normalizedSymbol = String(data?.symbol || "").trim().toUpperCase();
        const normalizedInterval = String(data?.interval || "").trim();
        candleBuffers[`${normalizedSymbol}|${normalizedInterval}`] = data.candles.map((candle) => ({
            time: candle.time,
            close: candle.close,
        }));
    }
    if (Array.isArray(data?.candles)) {
        logInfo("ws.mt5_candles.broadcasted", {
            symbol: data?.symbol || null,
            interval: data?.interval || null,
            candles_count: data.candles.length,
            delivered_clients: delivered,
        });
    }
}
