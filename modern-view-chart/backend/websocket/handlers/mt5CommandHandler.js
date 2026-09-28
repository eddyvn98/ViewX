import { logInfo, logWarn } from "../../logger.js";
import { incrementBridgeRouteMiss } from "../../runtime-state.js";
import { safeSend } from "../wsSend.js";

function normalizeOptional(value) {
    const text = String(value || "").trim();
    return text || null;
}

export function handleMt5Command({ ws, clients, bridgeRegistry }, data) {
    const senderMeta = clients.get(ws);
    const targetOwnerUserId = senderMeta?.userId ? String(senderMeta.userId) : null;
    const accountLogin = normalizeOptional(data?.account_login || data?.accountLogin);
    const terminalId = normalizeOptional(data?.terminal_id || data?.terminalId);
    const payload = JSON.stringify(data);

    const route = bridgeRegistry?.resolve({
        userId: targetOwnerUserId,
        accountLogin,
        terminalId,
    }) || { record: null, reason: "registry_unavailable", candidateCount: 0 };

    if (!route.record?.ws || route.record.ws.readyState !== route.record.ws.OPEN) {
        incrementBridgeRouteMiss();
        logWarn("ws.mt5_command.route_miss", {
            command: data?.command || null,
            owner_user_id: targetOwnerUserId,
            account_login: accountLogin,
            terminal_id: terminalId,
            route_reason: route.reason,
            candidate_count: route.candidateCount,
        });
        safeSend(ws, JSON.stringify({
            topic: "error",
            code: "service_unavailable",
            detail: "mt5_bridge_route_not_found",
            command: data?.command || null,
        }));
        return;
    }

    if (route.reason === "legacy_multiple_service_bridges") {
        logWarn("ws.mt5_command.multiple_service_bridges_detected", {
            connected_bridge_clients: route.candidateCount,
        });
    }

    route.record.ws.send(payload);

    const command = String(data?.command || "").trim();
    if (["get_candles", "get_symbol_info", "get_history", "get_candles_at"].includes(command)) {
        logInfo("ws.mt5_command.forwarded", {
            command,
            symbol: data?.symbol || null,
            interval: data?.interval || null,
            count: data?.count ?? null,
            owner_user_id: targetOwnerUserId,
            account_login: accountLogin,
            terminal_id: terminalId,
            route_reason: route.reason,
            bridge_client_mode: route.record.clientMode,
        });
    }
}
