import { isRecipientForMt5Owner, resolveBridgeOwnerUserId } from "../mt5Scope.js";

export function handleMt5SymbolInfo({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const ownerUserId = resolveBridgeOwnerUserId(senderMeta);

    // console.log(`[MT5] Routing symbol info for ${data.data?.symbol} to clients...`);
    const payload = JSON.stringify({
        topic: "mt5_symbol_info",
        data: data.data
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Owner(meta, ownerUserId)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
