import { logInfo } from "../../logger.js";

export function handleMt5Command({ clients }, data) {
    const payload = JSON.stringify(data);
    let forwarded = 0;
    for (const [clientWs, meta] of clients.entries()) {
        if (!meta?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
            forwarded += 1;
        }
    }
    const command = String(data?.command || "").trim();
    if (["get_candles", "get_symbol_info", "get_history", "get_candles_at"].includes(command)) {
        logInfo("ws.mt5_command.forwarded", {
            command,
            symbol: data?.symbol || null,
            interval: data?.interval || null,
            count: data?.count ?? null,
            forwarded_bridge_clients: forwarded,
        });
    }
}
