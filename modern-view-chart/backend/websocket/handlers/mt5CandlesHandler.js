import { logInfo } from "../../logger.js";

export function handleMt5Candles({ clients }, data) {
    const payload = JSON.stringify(data);
    let delivered = 0;
    for (const [clientWs, metadata] of clients.entries()) {
        if (metadata?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
            delivered += 1;
        }
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
