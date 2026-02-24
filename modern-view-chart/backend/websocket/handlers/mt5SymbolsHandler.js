import { broadcastToAll } from "../services/broadcastService.js";

export function handleMt5SymbolsAvailable({ ws, clients }, data) {
    console.log(`[MT5] Received ${data.symbols?.length} available symbols from bridge`);

    // Save to global so that new clients connecting later can receive it initially
    global.mt5AvailableSymbols = data.symbols;

    const payload = JSON.stringify({
        topic: "mt5_available_symbols",
        symbols: data.symbols
    });

    broadcastToAll(clients, payload);
}
