import { handleAuth } from "./handlers/authHandler.js";
import { handleSubscribeCandle, handleSubscribeSymbols } from "./handlers/subscribeHandler.js";
import { handleMt5Update } from "./handlers/mt5UpdateHandler.js";
import { handleMt5Positions } from "./handlers/mt5PositionsHandler.js";
import { handleMt5Candles } from "./handlers/mt5CandlesHandler.js";
import { handleMt5History } from "./handlers/mt5HistoryHandler.js";
import { handleMt5SymbolInfo } from "./handlers/mt5SymbolInfoHandler.js";
import { handleMt5Command } from "./handlers/mt5CommandHandler.js";
import { handleBinanceHistory } from "./handlers/binanceHistoryHandler.js";
import { handleBinanceCommand } from "./handlers/binanceCommandHandler.js";
import { handleAlertCommand } from "./handlers/alertCommandHandler.js";
import { handleAlertTriggered } from "./handlers/alertTriggeredHandler.js";
import { handleStrategySignal } from "./handlers/strategySignalHandler.js";
import { handleMt5SymbolsAvailable } from "./handlers/mt5SymbolsHandler.js";
import { handleVirtualTradeCommand } from "./handlers/virtualTradeHandler.js";
import { safeSend } from "./wsSend.js";
import { logInfo, logWarn } from "../logger.js";
import { hasRequiredRole } from "../auth/roles.js";
import { emergencyConfig } from "../config/emergency.js";
import { bridgeRegistry, isRouteMismatch, resolveRouteTarget } from "./bridgeRegistry.js";
import { requestIdGuard } from "./services/requestIdGuard.js";
import { tradeReconciliationService } from "./services/tradeReconciliationService.js";
import {
    incrementWsCrossUserBlock,
    incrementWsProEntitlementBlock,
    incrementWsReplayReject,
} from "../runtime-state.js";
import {
    getModuleEntitlementReason,
    getProEntitlementReason,
    hasRequiredModule,
    isProOnlyBinanceCommand,
    isProOnlyMt5Command,
} from "./services/proEntitlementGuard.js";

const STRATEGY_ENGINE_ENABLED = ((process.env.STRATEGY_ENGINE_ENABLED || "0").trim() === "1");
const AI_ENABLED = ((process.env.AI_ENABLED || "0").trim() === "1");
const REQUIRED_TRADE_ROLE = (process.env.WS_REQUIRE_ROLE_FOR_TRADING || "trader").trim().toLowerCase();
const WS_REQUIRE_PRO_POLICY_CONSENT = ((process.env.WS_REQUIRE_PRO_POLICY_CONSENT || "1").trim() === "1");
const WS_REQUIRE_TERMS_CONSENT = ((process.env.WS_REQUIRE_TERMS_CONSENT || "0").trim() === "1");
const WS_REQUIRE_PRIVACY_CONSENT = ((process.env.WS_REQUIRE_PRIVACY_CONSENT || "0").trim() === "1");
const MIN_BRIDGE_VERSION = String(process.env.MIN_BRIDGE_VERSION || "").trim();
const MIN_PROTOCOL_VERSION = String(process.env.MIN_PROTOCOL_VERSION || "").trim();
const BRIDGE_TOPICS = new Set([
    "mt5_update",
    "mt5_positions_update",
    "mt5_symbols_available",
    "mt5_candles",
    "mt5_candles_at",
    "mt5_history_deals",
    "mt5_symbol_info",
    "mt5_order_result",
    "alert_triggered",
]);

function normalizeRequestId(value) {
    const requestId = String(value || "").trim();
    return requestId || null;
}

function normalizeCommand(value) {
    const command = String(value || "").trim().toLowerCase();
    return command || null;
}

function buildErrorEnvelope({
    code,
    message,
    source = "websocket_router",
    retryable = false,
    requestId = null,
    command = null,
}) {
    return {
        code,
        message,
        source,
        retryable,
        request_id: normalizeRequestId(requestId),
        command: normalizeCommand(command),
    };
}

function emitWsError(ws, code, detail, options = {}) {
    const message = options.message || detail || code;
    safeSend(ws, JSON.stringify({
        topic: "error",
        code,
        ...(detail ? { detail } : {}),
        ...(options.requestId ? { request_id: normalizeRequestId(options.requestId) } : {}),
        ...(options.command ? { command: normalizeCommand(options.command) } : {}),
        error: buildErrorEnvelope({
            code,
            message,
            source: options.source || "websocket_router",
            retryable: Boolean(options.retryable),
            requestId: options.requestId,
            command: options.command,
        }),
    }));
}

function isTradingCommandAllowed(meta) {
    if (!meta) return false;
    if (meta.authType === "service") return true;
    return hasRequiredRole(meta.role || "viewer", REQUIRED_TRADE_ROLE);
}

const MT5_READ_ONLY_COMMANDS = new Set([
    "get_candles",
    "get_candles_at",
    "get_history",
    "get_symbol_info",
    "get_positions",
    "get_orders",
    "get_account",
]);

const BINANCE_READ_ONLY_COMMANDS = new Set(["get_account"]);

function normalizeCommandName(command) {
    return String(command || "")
        .trim()
        .toLowerCase();
}

function pickValue(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const normalized = String(value).trim();
        if (normalized) return normalized;
    }
    return null;
}

function applyConsentMetadata(target, payload = {}) {
    if (!target || !payload || typeof payload !== "object") return;

    const termsVersion = pickValue(payload.termsVersion, payload.terms_version);
    const termsAcceptedAt = pickValue(payload.termsAcceptedAt, payload.terms_accepted_at);
    const privacyVersion = pickValue(payload.privacyVersion, payload.privacy_version);
    const privacyAcceptedAt = pickValue(payload.privacyAcceptedAt, payload.privacy_accepted_at);
    const proPolicyVersion = pickValue(payload.proPolicyVersion, payload.pro_policy_version);
    const proPolicyAcceptedAt = pickValue(payload.proPolicyAcceptedAt, payload.pro_policy_accepted_at);

    if (termsVersion) target.termsVersion = termsVersion;
    if (termsAcceptedAt) target.termsAcceptedAt = termsAcceptedAt;
    if (privacyVersion) target.privacyVersion = privacyVersion;
    if (privacyAcceptedAt) target.privacyAcceptedAt = privacyAcceptedAt;
    if (proPolicyVersion) target.proPolicyVersion = proPolicyVersion;
    if (proPolicyAcceptedAt) target.proPolicyAcceptedAt = proPolicyAcceptedAt;
}

function collectMissingConsentFields(meta = {}) {
    const missing = [];

    if (WS_REQUIRE_PRO_POLICY_CONSENT) {
        if (!pickValue(meta.proPolicyVersion, meta.pro_policy_version)) missing.push("proPolicyVersion");
        if (!pickValue(meta.proPolicyAcceptedAt, meta.pro_policy_accepted_at)) missing.push("proPolicyAcceptedAt");
    }

    if (WS_REQUIRE_TERMS_CONSENT) {
        if (!pickValue(meta.termsVersion, meta.terms_version)) missing.push("termsVersion");
        if (!pickValue(meta.termsAcceptedAt, meta.terms_accepted_at)) missing.push("termsAcceptedAt");
    }

    if (WS_REQUIRE_PRIVACY_CONSENT) {
        if (!pickValue(meta.privacyVersion, meta.privacy_version)) missing.push("privacyVersion");
        if (!pickValue(meta.privacyAcceptedAt, meta.privacy_accepted_at)) missing.push("privacyAcceptedAt");
    }

    return missing;
}

function blockLegalConsent(ws, { topic, command, data, routeTarget, missingFields, senderMeta }) {
    incrementWsProEntitlementBlock();
    logWarn("ws.legal_consent.blocked", {
        topic,
        command,
        request_id: data?.request_id || data?.requestId || null,
        missing_fields: missingFields,
        user_id: routeTarget?.userId || null,
        account_id: routeTarget?.accountId || null,
        role: senderMeta?.role || null,
        plan: senderMeta?.plan || null,
    });
    logWarn("ws.trade.audit", {
        topic,
        command,
        request_id: data?.request_id || data?.requestId || null,
        user_id: routeTarget?.userId || null,
        account_id: routeTarget?.accountId || null,
        outcome: "blocked",
        reason: "legal_consent_required",
        missing_fields: missingFields,
    });
    emitWsError(ws, "forbidden", "legal_consent_required", {
        requestId: data?.request_id || data?.requestId || null,
        command: data?.command,
        source: "legal_consent_guard",
        retryable: false,
    });
}

function isReadOnlyMt5Command(command) {
    return MT5_READ_ONLY_COMMANDS.has(normalizeCommandName(command));
}

function isReadOnlyBinanceCommand(command) {
    return BINANCE_READ_ONLY_COMMANDS.has(normalizeCommandName(command));
}

function parseVersionParts(version) {
    const normalized = String(version || "").trim();
    if (!normalized) return null;

    const matches = normalized.match(/\d+/g);
    if (!matches || matches.length === 0) return null;

    return matches.slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

function compareSemverLike(leftVersion, rightVersion) {
    const leftParts = parseVersionParts(leftVersion);
    const rightParts = parseVersionParts(rightVersion);
    if (!leftParts || !rightParts) return null;

    const maxLen = Math.max(leftParts.length, rightParts.length, 3);
    for (let idx = 0; idx < maxLen; idx += 1) {
        const left = leftParts[idx] ?? 0;
        const right = rightParts[idx] ?? 0;
        if (left > right) return 1;
        if (left < right) return -1;
    }

    return 0;
}

function resolveVersionMetadata(meta = {}, data = {}) {
    return {
        bridgeVersion:
            data.bridgeVersion ||
            data.bridge_version ||
            data.extensionVersion ||
            data.extension_version ||
            meta.bridgeVersion ||
            meta.extensionVersion ||
            null,
        protocolVersion:
            data.protocolVersion ||
            data.protocol_version ||
            meta.protocolVersion ||
            null,
    };
}

function isVersionGateTopic(topic, data) {
    if (BRIDGE_TOPICS.has(topic)) return true;
    if (topic === "alert_command") return true;
    if (topic === "mt5_command" && !isReadOnlyMt5Command(data.command)) return true;
    if (topic === "binance_command" && !isReadOnlyBinanceCommand(data.command)) return true;
    return false;
}

function checkRuntimeVersionGate(topic, senderMeta, data) {
    if (!isVersionGateTopic(topic, data)) return { allowed: true };
    if (!MIN_BRIDGE_VERSION && !MIN_PROTOCOL_VERSION) return { allowed: true };

    const versions = resolveVersionMetadata(senderMeta, data);
    if (MIN_BRIDGE_VERSION) {
        const compared = compareSemverLike(versions.bridgeVersion, MIN_BRIDGE_VERSION);
        if (compared === null || compared < 0) {
            return {
                allowed: false,
                code: "upgrade_required",
                detail: `bridge_version_min_${MIN_BRIDGE_VERSION}`,
                versions,
            };
        }
    }

    if (MIN_PROTOCOL_VERSION) {
        const compared = compareSemverLike(versions.protocolVersion, MIN_PROTOCOL_VERSION);
        if (compared === null || compared < 0) {
            return {
                allowed: false,
                code: "upgrade_required",
                detail: `protocol_version_min_${MIN_PROTOCOL_VERSION}`,
                versions,
            };
        }
    }

    return { allowed: true };
}

function rejectReplayRequest(ws, senderMeta, data, topic, classification, ttlMs) {
    const command = normalizeCommandName(data.command);
    const requestId = String(data.request_id || data.requestId || "").trim();
    const detail = classification === "duplicate" ? "duplicate_request_id" : "replay_request_id";
    const routeTarget = resolveRouteTarget(senderMeta || {});

    incrementWsReplayReject();

    logWarn("ws.request_id_guard.rejected", {
        topic,
        command,
        request_id: requestId,
        request_id_classification: classification,
        request_id_ttl_ms: ttlMs,
        auth_type: senderMeta.authType || null,
        role: senderMeta.role || null,
        plan: senderMeta.plan || null,
    });
    logWarn("ws.trade.audit", {
        topic,
        command,
        request_id: requestId || null,
        user_id: routeTarget.userId || null,
        account_id: routeTarget.accountId || null,
        outcome: "rejected",
        reason: detail,
    });

    emitWsError(ws, "conflict", detail, {
        requestId,
        command,
        source: "request_id_guard",
        retryable: false,
    });
}

function applyRequestIdGuard(ws, senderMeta, data, topic) {
    if (!data || typeof data !== "object") return true;

    const command = normalizeCommandName(data.command);
    const shouldGuard =
        (topic === "mt5_command" && !isReadOnlyMt5Command(command)) ||
        (topic === "binance_command" && !isReadOnlyBinanceCommand(command));
    if (!shouldGuard) return true;

    const claim = requestIdGuard.claim(data);
    if (claim.accepted) return true;

    rejectReplayRequest(ws, senderMeta, data, topic, claim.classification || "duplicate", claim.ttlMs);
    return false;
}

function claimTradeReconciliation(routeTarget, topic, data) {
    return tradeReconciliationService.claimOutgoing({
        topic,
        command: data?.command,
        requestId: data?.request_id || data?.requestId || null,
        routeTarget,
        symbol: data?.symbol || null,
    });
}

function emitReconciliationState(ws, topic, data, state) {
    const requestId = data?.request_id || data?.requestId || null;
    const command = normalizeCommandName(data?.command);
    const payload = {
        topic: topic === "mt5_command" ? "mt5_order_result" : "binance_order_result",
        status: state,
        request_id: requestId,
        command,
        reconciliation: {
            state,
        },
    };
    if (state === "pending" && Number.isFinite(data?.retryAfterMs)) {
        payload.reconciliation.retry_after_ms = data.retryAfterMs;
    }
    safeSend(ws, JSON.stringify(payload));
}

export function setupMessageRouter(clients, mt5Prices, subscriptionIndex) {
    tradeReconciliationService.onAmbiguous((entry) => {
        logWarn("ws.trade.reconciliation.timeout", {
            request_id: entry.requestId,
            topic: entry.topic,
            command: entry.command,
            user_id: entry.routeTarget?.userId || null,
            account_id: entry.routeTarget?.accountId || null,
            terminal_id: entry.routeTarget?.terminalId || null,
            retries: entry.retries,
        });
    });

    return async (ws, msg) => {
        try {
            const data = JSON.parse(msg.toString());
            const senderMeta = clients.get(ws);
            if (!senderMeta) return;
            applyConsentMetadata(senderMeta, data);

            const senderRouteTarget = resolveRouteTarget(senderMeta);
            const requestedRouteTarget = resolveRouteTarget(data);
            const hasRequestedRoute = Boolean(requestedRouteTarget.userId || requestedRouteTarget.accountId);
            if (hasRequestedRoute && isRouteMismatch(senderRouteTarget, requestedRouteTarget)) {
                incrementWsCrossUserBlock();
                logWarn("ws.route.cross_user_blocked", {
                    topic: data.topic || data.event || data.type || null,
                    sender_user_id: senderRouteTarget.userId || null,
                    sender_account_id: senderRouteTarget.accountId || null,
                    sender_terminal_id: senderRouteTarget.terminalId || null,
                    target_user_id: requestedRouteTarget.userId || null,
                    target_account_id: requestedRouteTarget.accountId || null,
                    target_terminal_id: requestedRouteTarget.terminalId || null,
                });
                emitWsError(ws, "forbidden", "cross_user_routing_attempt", {
                    requestId: data?.request_id || data?.requestId || null,
                    command: data?.command,
                    source: "route_guard",
                    retryable: false,
                });
                return;
            }

            const routeTarget = hasRequestedRoute
                ? {
                    userId: requestedRouteTarget.userId || senderRouteTarget.userId || null,
                    accountId: requestedRouteTarget.accountId || senderRouteTarget.accountId || null,
                    terminalId: requestedRouteTarget.terminalId || senderRouteTarget.terminalId || null,
                }
                : senderRouteTarget;

            const context = { ws, clients, mt5Prices, subscriptionIndex, routeTarget };
            const msgTopic = data.topic || data.event || data.type;
            if (typeof msgTopic !== "string" || !msgTopic) return;

            if (BRIDGE_TOPICS.has(msgTopic) && !senderMeta.isBridgeAuthenticated) {
                emitWsError(ws, "forbidden", "bridge_topic_requires_authenticated_bridge", {
                    requestId: data?.request_id || data?.requestId || null,
                    command: data?.command,
                    source: "bridge_auth_guard",
                    retryable: false,
                });
                return;
            }

            const versionGate = checkRuntimeVersionGate(msgTopic, senderMeta, data);
            if (!versionGate.allowed) {
                logWarn("ws.runtime_version.blocked", {
                    topic: msgTopic,
                    command: normalizeCommandName(data.command),
                    detail: versionGate.detail,
                    bridge_version: versionGate.versions?.bridgeVersion || null,
                    protocol_version: versionGate.versions?.protocolVersion || null,
                    min_bridge_version: MIN_BRIDGE_VERSION || null,
                    min_protocol_version: MIN_PROTOCOL_VERSION || null,
                    auth_type: senderMeta.authType || null,
                    role: senderMeta.role || null,
                });
                emitWsError(ws, versionGate.code, versionGate.detail, {
                    requestId: data?.request_id || data?.requestId || null,
                    command: data?.command,
                    source: "runtime_version_guard",
                    retryable: false,
                });
                return;
            }

            switch (msgTopic) {
                case "auth":
                    handleAuth(context, data);
                    break;
                case "subscribeCandle":
                    handleSubscribeCandle(context, data);
                    break;
                case "subscribeSymbols":
                    handleSubscribeSymbols(context, data);
                    break;
                case "app_ping":
                    safeSend(ws, JSON.stringify({ topic: "app_pong", echoedAt: Date.now(), sentAt: data.sentAt || null }));
                    break;
                case "mt5_update":
                    handleMt5Update(context, data);
                    break;
                case "mt5_positions_update":
                    handleMt5Positions(context, data);
                    break;
                case "mt5_history_deals":
                    handleMt5History(context, data);
                    break;
                case "mt5_symbol_info":
                    handleMt5SymbolInfo(context, data);
                    break;
                case "request_analysis":
                case "request_optimization": {
                    if (!AI_ENABLED) {
                        emitWsError(ws, "service_unavailable", "ai_temporarily_disabled");
                        break;
                    }
                    if (!STRATEGY_ENGINE_ENABLED) {
                        logInfo("strategy_engine.disabled_topic_ignored", { topic: msgTopic });
                        break;
                    }
                    const payload = JSON.stringify(data);
                    for (const [clientWs] of clients.entries()) {
                        if (clientWs.readyState === clientWs.OPEN) safeSend(clientWs, payload);
                    }
                    break;
                }
                case "mt5_candles":
                case "mt5_candles_at":
                    handleMt5Candles(context, data);
                    break;
                case "mt5_command":
                    if (isProOnlyMt5Command(data.command) && !hasRequiredModule("your_mt5", senderMeta, data)) {
                        const reason = getModuleEntitlementReason("your_mt5", senderMeta, data) || getProEntitlementReason(senderMeta, data);
                        incrementWsProEntitlementBlock();
                        logWarn("ws.entitlement.blocked", {
                            topic: msgTopic,
                            command: normalizeCommandName(data.command),
                            reason,
                            role: senderMeta.role || null,
                            plan: senderMeta.plan || null,
                            modules: senderMeta.modules || null,
                        });
                        logWarn("ws.trade.audit", {
                            topic: msgTopic,
                            command: normalizeCommandName(data.command),
                            request_id: data?.request_id || data?.requestId || null,
                            user_id: routeTarget.userId || null,
                            account_id: routeTarget.accountId || null,
                            outcome: "blocked",
                            reason,
                        });
                        emitWsError(ws, "forbidden", reason, {
                            requestId: data?.request_id || data?.requestId || null,
                            command: data?.command,
                            source: "entitlement_guard",
                            retryable: false,
                        });
                        return;
                    }
                    if (isProOnlyMt5Command(data.command) && senderMeta.authType !== "service") {
                        const missingConsentFields = collectMissingConsentFields(senderMeta);
                        if (missingConsentFields.length > 0) {
                            blockLegalConsent(ws, {
                                topic: msgTopic,
                                command: normalizeCommandName(data.command),
                                data,
                                routeTarget,
                                missingFields: missingConsentFields,
                                senderMeta,
                            });
                            return;
                        }
                    }
                    if (emergencyConfig.enabled && emergencyConfig.blockTrading && !isReadOnlyMt5Command(data.command)) {
                        emitWsError(ws, "service_unavailable", "emergency_mode_trading_blocked", {
                            requestId: data?.request_id || data?.requestId || null,
                            command: data?.command,
                            source: "emergency_guard",
                            retryable: true,
                        });
                        return;
                    }
                    if (!isReadOnlyMt5Command(data.command)) {
                        const reconciliationClaim = claimTradeReconciliation(routeTarget, msgTopic, data);
                        if (!reconciliationClaim.shouldForward) {
                            if (reconciliationClaim.reason === "pending") {
                                emitReconciliationState(ws, msgTopic, { ...data, retryAfterMs: reconciliationClaim.retryAfterMs }, "pending");
                                return;
                            }
                            if (reconciliationClaim.reason === "already_acknowledged") {
                                emitReconciliationState(ws, msgTopic, data, "acknowledged");
                                return;
                            }
                            emitWsError(ws, "conflict", "reconnect_retry_exhausted", {
                                requestId: data?.request_id || data?.requestId || null,
                                command: data?.command,
                                source: "trade_reconciliation_guard",
                                retryable: false,
                            });
                            return;
                        }
                    }
                    if (!applyRequestIdGuard(ws, senderMeta, data, msgTopic)) {
                        return;
                    }
                    if (!isReadOnlyMt5Command(data.command) && !isTradingCommandAllowed(senderMeta)) {
                        handleVirtualTradeCommand(context, data);
                        return;
                    }
                    handleMt5Command({ ...context, senderMeta }, data);
                    break;
                case "alert_command":
                    if (emergencyConfig.enabled && emergencyConfig.blockTrading) {
                        emitWsError(ws, "service_unavailable", "emergency_mode_trading_blocked");
                        return;
                    }
                    if (!isTradingCommandAllowed(senderMeta)) {
                        emitWsError(ws, "forbidden", "trading_role_required", {
                            requestId: data?.request_id || data?.requestId || null,
                            command: data?.command,
                            source: "role_guard",
                            retryable: false,
                        });
                        return;
                    }
                    handleAlertCommand(context, data);
                    break;
                case "alert_triggered":
                    handleAlertTriggered(context, data);
                    break;
                case "get_binance_candles":
                    handleBinanceHistory(context, data);
                    break;
                case "binance_command":
                    if (isProOnlyBinanceCommand(data.command) && !hasRequiredModule("binance_trade", senderMeta, data)) {
                        const reason = getModuleEntitlementReason("binance_trade", senderMeta, data) || getProEntitlementReason(senderMeta, data);
                        incrementWsProEntitlementBlock();
                        logWarn("ws.entitlement.blocked", {
                            topic: msgTopic,
                            command: normalizeCommandName(data.command),
                            reason,
                            role: senderMeta.role || null,
                            plan: senderMeta.plan || null,
                            modules: senderMeta.modules || null,
                        });
                        logWarn("ws.trade.audit", {
                            topic: msgTopic,
                            command: normalizeCommandName(data.command),
                            request_id: data?.request_id || data?.requestId || null,
                            user_id: routeTarget.userId || null,
                            account_id: routeTarget.accountId || null,
                            outcome: "blocked",
                            reason,
                        });
                        emitWsError(ws, "forbidden", reason, {
                            requestId: data?.request_id || data?.requestId || null,
                            command: data?.command,
                            source: "entitlement_guard",
                            retryable: false,
                        });
                        return;
                    }
                    if (isProOnlyBinanceCommand(data.command) && senderMeta.authType !== "service") {
                        const missingConsentFields = collectMissingConsentFields(senderMeta);
                        if (missingConsentFields.length > 0) {
                            blockLegalConsent(ws, {
                                topic: msgTopic,
                                command: normalizeCommandName(data.command),
                                data,
                                routeTarget,
                                missingFields: missingConsentFields,
                                senderMeta,
                            });
                            return;
                        }
                    }
                    if (emergencyConfig.enabled && emergencyConfig.blockTrading && !isReadOnlyBinanceCommand(data.command)) {
                        emitWsError(ws, "service_unavailable", "emergency_mode_trading_blocked", {
                            requestId: data?.request_id || data?.requestId || null,
                            command: data?.command,
                            source: "emergency_guard",
                            retryable: true,
                        });
                        return;
                    }
                    if (!isReadOnlyBinanceCommand(data.command)) {
                        const reconciliationClaim = claimTradeReconciliation(routeTarget, msgTopic, data);
                        if (!reconciliationClaim.shouldForward) {
                            if (reconciliationClaim.reason === "pending") {
                                emitReconciliationState(ws, msgTopic, { ...data, retryAfterMs: reconciliationClaim.retryAfterMs }, "pending");
                                return;
                            }
                            if (reconciliationClaim.reason === "already_acknowledged") {
                                emitReconciliationState(ws, msgTopic, data, "acknowledged");
                                return;
                            }
                            emitWsError(ws, "conflict", "reconnect_retry_exhausted", {
                                requestId: data?.request_id || data?.requestId || null,
                                command: data?.command,
                                source: "trade_reconciliation_guard",
                                retryable: false,
                            });
                            return;
                        }
                    }
                    if (!applyRequestIdGuard(ws, senderMeta, data, msgTopic)) {
                        return;
                    }
                    if (!isReadOnlyBinanceCommand(data.command) && !isTradingCommandAllowed(senderMeta)) {
                        handleVirtualTradeCommand(context, data);
                        return;
                    }
                    handleBinanceCommand(context.ws, data, { routeTarget });
                    break;
                case "mt5_order_result": {
                    const resolved = tradeReconciliationService.resolveFromBridgeResult({
                        topic: "mt5_command",
                        command: data?.command,
                        requestId: data?.request_id || data?.requestId || null,
                        routeTarget,
                        symbol: data?.symbol || null,
                    });
                    const payload = {
                        ...data,
                        ...(resolved?.requestId ? { request_id: resolved.requestId } : {}),
                        ...(resolved?.matchedBy ? { reconciliation: { matched_by: resolved.matchedBy } } : {}),
                    };
                    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
                    const payloadRaw = JSON.stringify(payload);
                    for (const clientWs of recipients) {
                        safeSend(clientWs, payloadRaw);
                    }
                    break;
                }
                case "strategy_signal":
                    if (!STRATEGY_ENGINE_ENABLED) {
                        logInfo("strategy_engine.disabled_topic_ignored", { topic: msgTopic });
                        break;
                    }
                    handleStrategySignal(context, data);
                    break;
                case "mt5_symbols_available":
                    handleMt5SymbolsAvailable(context, data);
                    break;
                default:
                    logInfo("ws.topic.unknown", { topic: msgTopic });
            }
        } catch (error) {
            logInfo("ws.message.error", { error: error?.message || String(error) });
        }
    };
}
