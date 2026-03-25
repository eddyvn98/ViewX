import { bridgeRegistry } from "../bridgeRegistry.js";

export function handleMt5SymbolsAvailable({ ws, clients, routeTarget }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    console.log(`[MT5] Received ${data.symbols?.length} available symbols from bridge`);

    // Save to global so that new clients connecting later can receive it initially
    global.mt5AvailableSymbols = data.symbols;

    const payload = JSON.stringify({
        topic: "mt5_available_symbols",
        symbols: data.symbols
    });

    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }
}
