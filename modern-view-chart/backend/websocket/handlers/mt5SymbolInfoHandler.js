import { bridgeRegistry } from "../bridgeRegistry.js";

export function handleMt5SymbolInfo({ ws, clients, routeTarget }, data) {
    // console.log(`[MT5] Routing symbol info for ${data.data?.symbol} to clients...`);
    const payload = JSON.stringify({
        topic: "mt5_symbol_info",
        data: data.data
    });

    const senderMeta = clients.get(ws);
    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }
}
