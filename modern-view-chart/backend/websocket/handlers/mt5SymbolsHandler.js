import { isRecipientForMt5Scope, resolveBridgeMt5Scope, setScopedMt5Symbols, scopeMetadata } from "../mt5Scope.js";

export function handleMt5SymbolsAvailable({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const mt5Scope = resolveBridgeMt5Scope(senderMeta);

    console.log(`[MT5] Received ${data.symbols?.length} available symbols from bridge`);

    setScopedMt5Symbols(mt5Scope, data.symbols);

    const payload = JSON.stringify({
        topic: "mt5_available_symbols",
        symbols: data.symbols,
        source: mt5Scope.source,
        mt5_scope: scopeMetadata(mt5Scope),
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Scope(meta, mt5Scope)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
