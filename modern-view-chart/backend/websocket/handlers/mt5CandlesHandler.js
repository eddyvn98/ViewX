export function handleMt5Candles({ clients }, data) {
    const payload = JSON.stringify(data);
    for (const [clientWs, metadata] of clients.entries()) {
        // Broadcast to all valid clients except the Bridge itself (which sent it)
        // Ensure Strategy Engine gets it (metadata.type === 'strategy_engine')
        if (clientWs.readyState === clientWs.OPEN && !clientWs.isBridge) {
            clientWs.send(payload);
        }
    }
}
