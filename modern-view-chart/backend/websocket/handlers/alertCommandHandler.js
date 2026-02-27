// Forward alert commands to MT5 Bridge
export function handleAlertCommand(context, data) {
    const { clients } = context;

    for (const [ws, meta] of clients.entries()) {
        if (!meta?.isBridgeAuthenticated) continue;
        if (ws.readyState !== ws.OPEN) continue;
        ws.send(JSON.stringify(data));
        console.log(`[ALERT] Forwarded ${data.command} command to MT5 Bridge`);
        break;
    }
}
