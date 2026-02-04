export function handleMt5SymbolInfo({ ws, clients }, data) {
    // console.log(`[MT5] Routing symbol info for ${data.data?.symbol} to clients...`);
    const payload = JSON.stringify({
        topic: "mt5_symbol_info",
        data: data.data
    });

    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
