import { bridgeRegistry } from "../bridgeRegistry.js";
import { resolveBridgeKey } from "../bridgeRegistry.js";
import { normalizeMt5SymbolCatalog } from "../services/mt5SymbolNormalizer.js";

export function handleMt5SymbolsAvailable({ ws, clients, routeTarget }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    const normalizedSymbols = normalizeMt5SymbolCatalog(data.symbols, senderMeta);
    console.log(`[MT5] Received ${normalizedSymbols.length} available symbols from bridge`);

    if (!global.mt5AvailableSymbolsByRoute) {
        global.mt5AvailableSymbolsByRoute = new Map();
    }
    const routeKey = resolveBridgeKey(routeTarget || senderMeta);
    if (routeKey) {
        const storageKey = `${routeKey.userId}::${routeKey.accountId}::${routeKey.terminalId}`;
        global.mt5AvailableSymbolsByRoute.set(storageKey, normalizedSymbols);
    }
    global.mt5AvailableSymbols = normalizedSymbols;

    const payload = JSON.stringify({
        topic: "mt5_available_symbols",
        symbols: normalizedSymbols,
        mt5_source: data.mt5_source || "MT5",
    });

    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }
}
