// Forward alert commands to MT5 Bridge
export function handleAlertCommand(context, data) {
    const { clients } = context;

    // Find the MT5 Bridge client
    for (const [ws, meta] of clients.entries()) {
        if (ws.isBridge) {
            // Forward the entire message to the bridge
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(data));
                console.log(`[ALERT] Forwarded ${data.command} command to MT5 Bridge`);
            }
            break;
        }
    }
}
