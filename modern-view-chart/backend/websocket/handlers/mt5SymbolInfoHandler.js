import { isRecipientForMt5Scope, resolveBridgeMt5Scope, scopeMetadata } from "../mt5Scope.js";

export function handleMt5SymbolInfo({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const mt5Scope = resolveBridgeMt5Scope(senderMeta);

    // console.log(`[MT5] Routing symbol info for ${data.data?.symbol} to clients...`);
    const payload = JSON.stringify({
        topic: "mt5_symbol_info",
        data: data.data,
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
