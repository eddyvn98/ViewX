import { logInfo, logWarn } from "../../logger.js";
import { resolveBridgeOwnerUserId } from "../mt5Scope.js";

export function handleMt5Command({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    const targetOwnerUserId = senderMeta?.userId ? String(senderMeta.userId) : null;
    const payload = JSON.stringify(data);
    const bridgeSockets = [];
    for (const [clientWs, meta] of clients.entries()) {
        if (!meta?.isBridgeAuthenticated) continue;
        if (resolveBridgeOwnerUserId(meta) !== targetOwnerUserId) continue;
        if (clientWs.readyState === clientWs.OPEN) bridgeSockets.push(clientWs);
    }

    if (bridgeSockets.length > 1) {
        logWarn("ws.mt5_command.multiple_bridges_detected", {
            connected_bridge_clients: bridgeSockets.length,
        });
    }

    let forwarded = 0;
    const primaryBridge = bridgeSockets[0];
    if (primaryBridge) {
        primaryBridge.send(payload);
        forwarded = 1;
    }

    const command = String(data?.command || "").trim();
    if (["get_candles", "get_symbol_info", "get_history", "get_candles_at"].includes(command)) {
        logInfo("ws.mt5_command.forwarded", {
            command,
            symbol: data?.symbol || null,
            interval: data?.interval || null,
            count: data?.count ?? null,
            owner_user_id: targetOwnerUserId,
            forwarded_bridge_clients: forwarded,
        });
    }
}
