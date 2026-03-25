import { bridgeRegistry } from "../bridgeRegistry.js";

// Broadcast alert_triggered from MT5 Bridge to all frontend clients
export function handleAlertTriggered({ ws, clients, routeTarget }, data) {
    console.log('[ALERT] Broadcasting alert_triggered to clients:', data);

    const payload = JSON.stringify(data);
    let sentCount = 0;

    const senderMeta = clients.get(ws);
    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
        sentCount++;
    }

    console.log(`[ALERT] Sent to ${sentCount} client(s)`);
}
