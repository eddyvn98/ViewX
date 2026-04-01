import { logInfo, logWarn } from "../../logger.js";

const DEFAULT_ACK_TIMEOUT_MS = 12 * 1000;
const DEFAULT_FINALIZE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_SWEEP_MS = 3 * 1000;
const DEFAULT_MAX_RETRIES = 2;

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function normalize(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized || null;
}

function buildRouteKey(routeTarget = {}) {
    const userId = normalize(routeTarget.userId) || "anon";
    const accountId = normalize(routeTarget.accountId) || "default";
    const terminalId = normalize(routeTarget.terminalId) || "default_terminal";
    return `${userId}:${accountId}:${terminalId}`;
}

function buildScopeKey({ topic, command, requestId, routeTarget }) {
    if (!requestId) return null;
    return `${buildRouteKey(routeTarget)}:${normalize(topic) || "unknown_topic"}:${normalize(command) || "unknown_command"}:${requestId}`;
}

function buildRelaxedMatchKey({ topic, command, symbol, routeTarget }) {
    return `${buildRouteKey(routeTarget)}:${normalize(topic) || "unknown_topic"}:${normalize(command) || "unknown_command"}:${normalize(symbol) || "unknown_symbol"}`;
}

class TradeReconciliationService {
    constructor() {
        this.ackTimeoutMs = parsePositiveInt(process.env.WS_RECON_ACK_TIMEOUT_MS, DEFAULT_ACK_TIMEOUT_MS);
        this.finalizeTtlMs = parsePositiveInt(process.env.WS_RECON_FINALIZE_TTL_MS, DEFAULT_FINALIZE_TTL_MS);
        this.maxRetries = parsePositiveInt(process.env.WS_RECON_MAX_RETRIES, DEFAULT_MAX_RETRIES);
        this.entries = new Map();
        this.ambiguousHandlers = new Set();
        this.sweepIntervalMs = parsePositiveInt(process.env.WS_RECON_SWEEP_INTERVAL_MS, DEFAULT_SWEEP_MS);
        this.sweepTimer = setInterval(() => this.sweepExpired(), this.sweepIntervalMs);
        if (typeof this.sweepTimer.unref === "function") {
            this.sweepTimer.unref();
        }
    }

    onAmbiguous(handler) {
        if (typeof handler !== "function") return () => {};
        this.ambiguousHandlers.add(handler);
        return () => this.ambiguousHandlers.delete(handler);
    }

    claimOutgoing({ topic, command, requestId, routeTarget = {}, symbol = null }) {
        const normalizedRequestId = String(requestId || "").trim();
        if (!normalizedRequestId) {
            return { shouldForward: true, reason: "no_request_id" };
        }

        const now = Date.now();
        this.sweepExpired(now);

        const scopeKey = buildScopeKey({
            topic,
            command,
            requestId: normalizedRequestId,
            routeTarget,
        });
        const existing = this.entries.get(scopeKey);
        if (existing) {
            if (existing.state === "pending") {
                return {
                    shouldForward: false,
                    reason: "pending",
                    retryAfterMs: Math.max(0, existing.expiresAt - now),
                    state: existing.state,
                };
            }

            if (existing.state === "acknowledged") {
                return {
                    shouldForward: false,
                    reason: "already_acknowledged",
                    state: existing.state,
                    resolvedAt: existing.resolvedAt,
                };
            }

            if (existing.state === "ambiguous" && existing.retries < this.maxRetries) {
                existing.state = "pending";
                existing.retries += 1;
                existing.updatedAt = now;
                existing.expiresAt = now + this.ackTimeoutMs;
                existing.meta = { ...existing.meta, symbol: symbol || existing.meta?.symbol || null };
                return {
                    shouldForward: true,
                    reason: "retry_ambiguous",
                    retryAttempt: existing.retries,
                };
            }

            return {
                shouldForward: false,
                reason: "retry_exhausted",
                state: existing.state,
            };
        }

        const entry = {
            key: scopeKey,
            scopeKey,
            requestId: normalizedRequestId,
            routeTarget: {
                userId: routeTarget.userId || null,
                accountId: routeTarget.accountId || null,
                terminalId: routeTarget.terminalId || null,
            },
            topic: normalize(topic) || "unknown_topic",
            command: normalize(command) || "unknown_command",
            state: "pending",
            retries: 0,
            createdAt: now,
            updatedAt: now,
            expiresAt: now + this.ackTimeoutMs,
            finalizeAt: now + this.finalizeTtlMs,
            meta: {
                symbol: symbol || null,
            },
        };
        this.entries.set(scopeKey, entry);
        return { shouldForward: true, reason: "first_dispatch" };
    }

    markImmediateResult({ topic, command, requestId, routeTarget = {}, status = "acknowledged" }) {
        const key = buildScopeKey({
            topic,
            command,
            requestId: String(requestId || "").trim(),
            routeTarget,
        });
        if (!key) return false;
        const entry = this.entries.get(key);
        if (!entry) return false;
        const now = Date.now();
        entry.state = status;
        entry.updatedAt = now;
        entry.resolvedAt = now;
        entry.finalizeAt = now + this.finalizeTtlMs;
        return true;
    }

    resolveFromBridgeResult({ topic, command, requestId, routeTarget = {}, symbol = null }) {
        const normalizedRequestId = String(requestId || "").trim();
        if (normalizedRequestId) {
            const key = buildScopeKey({ topic, command, requestId: normalizedRequestId, routeTarget });
            const entry = key ? this.entries.get(key) : null;
            if (!entry) return null;
            const now = Date.now();
            entry.state = "acknowledged";
            entry.updatedAt = now;
            entry.resolvedAt = now;
            entry.finalizeAt = now + this.finalizeTtlMs;
            return { requestId: entry.requestId, matchedBy: "request_id" };
        }

        const relaxedKey = buildRelaxedMatchKey({ topic, command, symbol, routeTarget });
        for (const entry of this.entries.values()) {
            if (entry.state !== "pending") continue;
            const entryRelaxed = buildRelaxedMatchKey({
                topic: entry.topic,
                command: entry.command,
                symbol: entry.meta?.symbol,
                routeTarget: entry.routeTarget,
            });
            if (entryRelaxed !== relaxedKey) continue;
            const now = Date.now();
            entry.state = "acknowledged";
            entry.updatedAt = now;
            entry.resolvedAt = now;
            entry.finalizeAt = now + this.finalizeTtlMs;
            return { requestId: entry.requestId, matchedBy: "route_command_symbol" };
        }

        return null;
    }

    sweepExpired(now = Date.now()) {
        for (const entry of this.entries.values()) {
            if (entry.state === "pending" && entry.expiresAt <= now) {
                entry.state = "ambiguous";
                entry.updatedAt = now;
                entry.finalizeAt = now + this.finalizeTtlMs;
                logWarn("ws.trade.reconciliation.ambiguous", {
                    request_id: entry.requestId,
                    topic: entry.topic,
                    command: entry.command,
                    user_id: entry.routeTarget.userId || null,
                    account_id: entry.routeTarget.accountId || null,
                    terminal_id: entry.routeTarget.terminalId || null,
                    retries: entry.retries,
                });
                for (const handler of this.ambiguousHandlers) {
                    try {
                        handler(entry);
                    } catch (error) {
                        logWarn("ws.trade.reconciliation.ambiguous_handler_failed", {
                            error: error?.message || String(error),
                        });
                    }
                }
            }
            if (entry.finalizeAt <= now) {
                this.entries.delete(entry.key);
            }
        }
    }

    markRouteMiss({ topic, command, requestId, routeTarget = {} }) {
        const matched = this.markImmediateResult({
            topic,
            command,
            requestId,
            routeTarget,
            status: "ambiguous",
        });
        if (matched) {
            logInfo("ws.trade.reconciliation.route_miss", {
                request_id: requestId || null,
                topic: normalize(topic),
                command: normalize(command),
                user_id: routeTarget.userId || null,
                account_id: routeTarget.accountId || null,
            });
        }
    }
}

export const tradeReconciliationService = new TradeReconciliationService();
export default tradeReconciliationService;

