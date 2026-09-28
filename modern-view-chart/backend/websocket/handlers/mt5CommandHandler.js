import { logInfo, logWarn } from "../../logger.js";
import { incrementBridgeRouteMiss } from "../../runtime-state.js";
import { safeSend } from "../wsSend.js";

const WRITE_COMMANDS = new Set([
    "order",
    "place_order",
    "buy",
    "sell",
    "modify",
    "close",
    "delete",
    "cancel",
]);

const WRITE_REQUEST_TTL_MS = 5 * 60 * 1000;
const pendingWriteRequests = new Map();
const completedWriteRequests = new Map();

function normalizeOptional(value) {
    const text = String(value || "").trim();
    return text || null;
}

function normalizeCommand(value) {
    return String(value || "").trim().toLowerCase();
}

function isWriteCommand(command) {
    return WRITE_COMMANDS.has(normalizeCommand(command));
}

function cleanupExpiredRequests(now = Date.now()) {
    for (const [requestId, entry] of pendingWriteRequests.entries()) {
        if (entry.expiresAt <= now) pendingWriteRequests.delete(requestId);
    }
    for (const [requestId, entry] of completedWriteRequests.entries()) {
        if (entry.expiresAt <= now) completedWriteRequests.delete(requestId);
    }
}

function sameRequestScope(entry, { ownerUserId, accountLogin, terminalId }) {
    return String(entry.ownerUserId || "") === String(ownerUserId || "")
        && String(entry.accountLogin || "") === String(accountLogin || "")
        && String(entry.terminalId || "") === String(terminalId || "");
}

function emitCommandError(ws, {
    code,
    detail,
    command,
    requestId = null,
    accountLogin = null,
    terminalId = null,
}) {
    safeSend(ws, JSON.stringify({
        topic: "error",
        code,
        detail,
        command: command || null,
        ...(requestId ? { request_id: requestId } : {}),
        ...(accountLogin ? { account_login: accountLogin } : {}),
        ...(terminalId ? { terminal_id: terminalId } : {}),
    }));
}

export function handleMt5Command({ ws, clients, bridgeRegistry }, data) {
    cleanupExpiredRequests();

    const senderMeta = clients.get(ws);
    const command = normalizeCommand(data?.command);
    const writeCommand = isWriteCommand(command);
    const requestId = normalizeOptional(data?.request_id || data?.requestId);
    const explicitAccountLogin = normalizeOptional(data?.account_login || data?.accountLogin);
    const explicitTerminalId = normalizeOptional(data?.terminal_id || data?.terminalId);
    const accountLogin = explicitAccountLogin || normalizeOptional(senderMeta?.selectedMt5AccountLogin);
    const terminalId = explicitTerminalId || normalizeOptional(senderMeta?.selectedMt5TerminalId);
    const ownerUserId = senderMeta?.userId ? String(senderMeta.userId) : null;
    const targetOwnerUserId = accountLogin && ownerUserId ? ownerUserId : null;

    if (writeCommand && accountLogin && !requestId) {
        emitCommandError(ws, {
            code: "invalid_request",
            detail: "mt5_write_request_id_required",
            command,
            accountLogin,
            terminalId,
        });
        return;
    }

    if (writeCommand && requestId) {
        const scope = { ownerUserId: targetOwnerUserId, accountLogin, terminalId };
        const completed = completedWriteRequests.get(requestId);
        if (completed) {
            if (!sameRequestScope(completed, scope)) {
                emitCommandError(ws, {
                    code: "conflict",
                    detail: "mt5_request_id_scope_mismatch",
                    command,
                    requestId,
                    accountLogin,
                    terminalId,
                });
                return;
            }
            safeSend(ws, JSON.stringify({
                ...completed.payload,
                duplicate: true,
                cached: true,
            }));
            return;
        }

        const pending = pendingWriteRequests.get(requestId);
        if (pending) {
            if (!sameRequestScope(pending, scope)) {
                emitCommandError(ws, {
                    code: "conflict",
                    detail: "mt5_request_id_scope_mismatch",
                    command,
                    requestId,
                    accountLogin,
                    terminalId,
                });
                return;
            }
            safeSend(ws, JSON.stringify({
                topic: "mt5_order_result",
                request_id: requestId,
                command,
                success: false,
                status: "pending",
                duplicate: true,
                message: "request_already_in_flight",
                account_login: accountLogin,
                terminal_id: terminalId,
            }));
            return;
        }
    }

    const route = bridgeRegistry?.resolve({
        userId: targetOwnerUserId,
        accountLogin,
        terminalId,
    }) || { record: null, reason: "registry_unavailable", candidateCount: 0 };

    if (!route.record?.ws || route.record.ws.readyState !== route.record.ws.OPEN) {
        incrementBridgeRouteMiss();
        logWarn("ws.mt5_command.route_miss", {
            command: command || null,
            request_id: requestId,
            owner_user_id: targetOwnerUserId,
            account_login: accountLogin,
            terminal_id: terminalId,
            route_reason: route.reason,
            candidate_count: route.candidateCount,
        });
        emitCommandError(ws, {
            code: "service_unavailable",
            detail: "mt5_bridge_route_not_found",
            command,
            requestId,
            accountLogin,
            terminalId,
        });
        return;
    }

    if (route.reason === "legacy_multiple_service_bridges") {
        logWarn("ws.mt5_command.multiple_service_bridges_detected", {
            connected_bridge_clients: route.candidateCount,
        });
    }

    const broker = normalizeOptional(data?.broker) || normalizeOptional(route.record.broker);
    const payload = {
        ...data,
        command,
        ...(requestId ? { request_id: requestId } : {}),
        ...(accountLogin ? { account_login: accountLogin } : {}),
        ...(terminalId ? { terminal_id: terminalId } : {}),
        ...(broker ? { broker } : {}),
    };

    if (writeCommand && requestId) {
        pendingWriteRequests.set(requestId, {
            clientWs: ws,
            ownerUserId: targetOwnerUserId,
            accountLogin,
            terminalId,
            broker,
            command,
            symbol: normalizeOptional(data?.symbol),
            expiresAt: Date.now() + WRITE_REQUEST_TTL_MS,
        });
    }

    try {
        route.record.ws.send(JSON.stringify(payload));
    } catch (error) {
        if (requestId) pendingWriteRequests.delete(requestId);
        logWarn("ws.mt5_command.forward_failed", {
            command,
            request_id: requestId,
            error: error?.message || String(error),
        });
        emitCommandError(ws, {
            code: "service_unavailable",
            detail: "mt5_bridge_send_failed",
            command,
            requestId,
            accountLogin,
            terminalId,
        });
        return;
    }

    if (writeCommand || ["get_candles", "get_symbol_info", "get_history", "get_candles_at"].includes(command)) {
        logInfo("ws.mt5_command.forwarded", {
            command,
            request_id: requestId,
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

export function handleMt5OrderResult({ ws, clients }, data) {
    cleanupExpiredRequests();

    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    const requestId = normalizeOptional(data?.request_id || data?.requestId);
    if (!requestId) {
        logWarn("ws.mt5_order_result.missing_request_id", {
            command: data?.command || null,
        });
        return;
    }

    const pending = pendingWriteRequests.get(requestId);
    if (!pending) {
        logWarn("ws.mt5_order_result.unmatched", {
            request_id: requestId,
            command: data?.command || null,
        });
        return;
    }

    const bridgeOwnerUserId = senderMeta.authType === "user" && senderMeta.userId
        ? String(senderMeta.userId)
        : null;
    const bridgeAccountLogin = normalizeOptional(senderMeta.bridgeAccountLogin);
    const bridgeTerminalId = normalizeOptional(senderMeta.bridgeTerminalId);

    if (pending.ownerUserId && bridgeOwnerUserId && pending.ownerUserId !== bridgeOwnerUserId) {
        logWarn("ws.mt5_order_result.owner_mismatch", {
            request_id: requestId,
            expected_owner_user_id: pending.ownerUserId,
            actual_owner_user_id: bridgeOwnerUserId,
        });
        return;
    }
    if (pending.accountLogin && bridgeAccountLogin && pending.accountLogin !== bridgeAccountLogin) {
        logWarn("ws.mt5_order_result.account_mismatch", {
            request_id: requestId,
            expected_account_login: pending.accountLogin,
            actual_account_login: bridgeAccountLogin,
        });
        return;
    }
    if (pending.terminalId && bridgeTerminalId && pending.terminalId !== bridgeTerminalId) {
        logWarn("ws.mt5_order_result.terminal_mismatch", {
            request_id: requestId,
            expected_terminal_id: pending.terminalId,
            actual_terminal_id: bridgeTerminalId,
        });
        return;
    }

    const success = Boolean(data?.success);
    const resultPayload = {
        topic: "mt5_order_result",
        request_id: requestId,
        command: normalizeCommand(data?.command || pending.command),
        success,
        status: success ? "success" : "error",
        retcode: data?.retcode ?? null,
        comment: data?.comment ?? null,
        message: data?.message ?? data?.comment ?? (success ? "order_executed" : "order_failed"),
        order: data?.order ?? null,
        deal: data?.deal ?? null,
        symbol: data?.symbol ?? pending.symbol ?? null,
        resolved_symbol: data?.resolved_symbol ?? data?.resolvedSymbol ?? null,
        duplicate: Boolean(data?.duplicate),
        source: pending.accountLogin ? "MT5_PERSONAL" : "MT5",
        account_login: pending.accountLogin,
        terminal_id: pending.terminalId,
        broker: pending.broker,
        mt5_scope: {
            source: pending.accountLogin ? "MT5_PERSONAL" : "MT5",
            account_login: pending.accountLogin,
            terminal_id: pending.terminalId,
            broker: pending.broker,
        },
    };

    pendingWriteRequests.delete(requestId);
    completedWriteRequests.set(requestId, {
        ownerUserId: pending.ownerUserId,
        accountLogin: pending.accountLogin,
        terminalId: pending.terminalId,
        expiresAt: Date.now() + WRITE_REQUEST_TTL_MS,
        payload: resultPayload,
    });

    if (pending.clientWs?.readyState === pending.clientWs.OPEN) {
        safeSend(pending.clientWs, JSON.stringify(resultPayload));
    }

    logInfo("ws.mt5_order_result.forwarded", {
        request_id: requestId,
        command: resultPayload.command,
        success,
        retcode: resultPayload.retcode,
        owner_user_id: pending.ownerUserId,
        account_login: pending.accountLogin,
        terminal_id: pending.terminalId,
    });
}

export function resetMt5WriteRequestTrackingForTests() {
    pendingWriteRequests.clear();
    completedWriteRequests.clear();
}
