export function handleMt5SymbolsAvailable({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    console.log(`[MT5] Received ${data.symbols?.length} available symbols from bridge`);

    // Save to global so that new clients connecting later can receive it initially
    global.mt5AvailableSymbols = data.symbols;

    const payload = JSON.stringify({
        topic: "mt5_available_symbols",
        symbols: data.symbols
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
