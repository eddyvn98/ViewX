import { isRecipientForMt5Owner, resolveBridgeOwnerUserId, setScopedMt5Symbols } from "../mt5Scope.js";

export function handleMt5SymbolsAvailable({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const ownerUserId = resolveBridgeOwnerUserId(senderMeta);

    console.log(`[MT5] Received ${data.symbols?.length} available symbols from bridge`);

    setScopedMt5Symbols(ownerUserId, data.symbols);

    const payload = JSON.stringify({
        topic: "mt5_available_symbols",
        symbols: data.symbols
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Owner(meta, ownerUserId)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
