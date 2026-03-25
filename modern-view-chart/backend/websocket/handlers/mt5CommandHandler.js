import { bridgeRegistry } from "../bridgeRegistry.js";
import { safeSend } from "../wsSend.js";
import { logInfo, logWarn } from "../../logger.js";

export function handleMt5Command({ ws, clients, routeTarget }, data) {
    const payload = JSON.stringify(data);
    const requestedBridge = bridgeRegistry.getPrimarySocket(routeTarget || {}, clients);
    const hasRouteTarget = Boolean(routeTarget?.userId || routeTarget?.accountId);

    const bridgeSockets = [];
    for (const [clientWs, meta] of clients.entries()) {
        if (!meta?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) bridgeSockets.push(clientWs);
    }

    if (!hasRouteTarget && bridgeSockets.length > 1) {
        logWarn("ws.mt5_command.multiple_bridges_detected", {
            connected_bridge_clients: bridgeSockets.length,
        });
    }

    let forwarded = 0;
    if (requestedBridge) {
        safeSend(requestedBridge, payload);
        forwarded = 1;
    } else if (hasRouteTarget) {
        safeSend(ws, JSON.stringify({
            topic: "error",
            code: "bridge_not_found",
            detail: "no_bridge_registered_for_requested_user_account",
        }));
        logWarn("ws.mt5_command.route_miss", {
            user_id: routeTarget.userId || null,
            account_id: routeTarget.accountId || null,
        });
        return;
    }

    const command = String(data?.command || "").trim();
    if (["get_candles", "get_symbol_info", "get_history", "get_candles_at"].includes(command)) {
        logInfo("ws.mt5_command.forwarded", {
            command,
            symbol: data?.symbol || null,
            interval: data?.interval || null,
            count: data?.count ?? null,
            request_id: data?.request_id || null,
            forwarded_bridge_clients: forwarded,
            routed_user_id: routeTarget?.userId || null,
            routed_account_id: routeTarget?.accountId || null,
        });
    }
}
