import { bridgeRegistry } from "../bridgeRegistry.js";
import { safeSend } from "../wsSend.js";
import { logInfo, logWarn } from "../../logger.js";
import { incrementWsRouteMiss, incrementWsRouteSuccess } from "../../runtime-state.js";
import { tradeReconciliationService } from "../services/tradeReconciliationService.js";

const TRADE_COMMANDS = new Set(["order", "place_order", "buy", "sell", "modify", "close", "delete", "cancel", "close_by_magic"]);

function normalizeCommand(command) {
    return String(command || "").trim().toLowerCase();
}

function logTradeAudit({ routeTarget, data, outcome, reason = null }) {
    const command = normalizeCommand(data?.command);
    if (!TRADE_COMMANDS.has(command)) return;

    logInfo("ws.trade.audit", {
        topic: "mt5_command",
        command,
        request_id: data?.request_id || data?.requestId || null,
        user_id: routeTarget?.userId || null,
        account_id: routeTarget?.accountId || null,
        terminal_id: routeTarget?.terminalId || null,
        outcome,
        reason,
    });
}

function buildErrorEnvelope({ code, message, requestId, command, retryable = false }) {
    return {
        code,
        message,
        source: "mt5_command_handler",
        retryable,
        request_id: requestId || null,
        command: normalizeCommand(command),
    };
}

export function handleMt5Command({ ws, clients, routeTarget }, data) {
    const payload = JSON.stringify(data);
    const requestId = data?.request_id || data?.requestId || null;
    const rawCommand = data?.command || null;
    const normalizedCommand = normalizeCommand(rawCommand);
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
        incrementWsRouteSuccess();
        logTradeAudit({ routeTarget, data, outcome: "forwarded" });
    } else if (hasRouteTarget) {
        incrementWsRouteMiss();
        const terminalMismatch = Boolean(
            routeTarget?.terminalId &&
            bridgeRegistry.hasAnyBridgeForUserAccount(routeTarget?.userId, routeTarget?.accountId),
        );
        safeSend(ws, JSON.stringify({
            topic: "error",
            code: "bridge_not_found",
            detail: "no_bridge_registered_for_requested_user_account",
            request_id: requestId,
            command: normalizedCommand,
            error: buildErrorEnvelope({
                code: "bridge_not_found",
                message: "No bridge registered for requested user/account",
                requestId,
                command: rawCommand,
                retryable: true,
            }),
        }));
        tradeReconciliationService.markRouteMiss({
            topic: "mt5_command",
            command: rawCommand,
            requestId,
            routeTarget,
        });
        logWarn("ws.mt5_command.route_miss", {
            user_id: routeTarget.userId || null,
            account_id: routeTarget.accountId || null,
            terminal_id: routeTarget.terminalId || null,
            terminal_mismatch: terminalMismatch,
        });
        logTradeAudit({
            routeTarget,
            data,
            outcome: "error",
            reason: "bridge_not_found",
        });
        return;
    }

    if (["get_candles", "get_symbol_info", "get_history", "get_candles_at"].includes(normalizedCommand)) {
        logInfo("ws.mt5_command.forwarded", {
            command: normalizedCommand,
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
