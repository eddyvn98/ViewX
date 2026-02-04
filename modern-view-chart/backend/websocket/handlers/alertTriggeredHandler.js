// Broadcast alert_triggered from MT5 Bridge to all frontend clients
export function handleAlertTriggered({ clients }, data) {
    console.log('[ALERT] Broadcasting alert_triggered to clients:', data);

    const payload = JSON.stringify(data);
    let sentCount = 0;

    for (const [clientWs] of clients.entries()) {
        // Don't send back to bridge
        if (!clientWs.isBridge && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
            sentCount++;
        }
    }

    console.log(`[ALERT] Sent to ${sentCount} client(s)`);
}
