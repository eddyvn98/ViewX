import { logInfo } from "../../logger.js";
import { bridgeRegistry } from "../bridgeRegistry.js";

export function handleMt5Candles({ ws, clients, routeTarget }, data) {
    const payload = JSON.stringify(data);
    const senderMeta = clients.get(ws);
    const routingMeta = routeTarget ? { ...(senderMeta || {}), ...routeTarget } : senderMeta;
    const recipients = bridgeRegistry.getTargetClientSockets(clients, routingMeta || {}, { excludeWs: ws });
    let delivered = 0;
    for (const clientWs of recipients) {
        clientWs.send(payload);
        delivered += 1;
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
