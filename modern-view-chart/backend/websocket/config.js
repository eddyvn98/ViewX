export const BRIDGE_TOPICS = new Set([
    "mt5_update",
    "mt5_positions_update",
    "mt5_symbols_available",
    "mt5_candles",
    "mt5_candles_at",
    "mt5_history_deals",
    "mt5_symbol_info",
    "mt5_order_result",
]);

function parseBooleanEnv(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
}

export function resolveQueryAuthPolicy() {
    const allowQueryAuth = parseBooleanEnv(process.env.WS_ALLOW_QUERY_AUTH, false);
    const fromEnv = (process.env.WS_QUERY_AUTH_DEPRECATED_UNTIL || "").trim();
    const fallbackMs = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const fallbackIso = new Date(fallbackMs).toISOString();
    const deprecatedUntil = new Date(fromEnv || fallbackIso);
    const untilMs = Number.isFinite(deprecatedUntil.getTime()) ? deprecatedUntil.getTime() : fallbackMs;

    return {
        allowQueryAuth,
        deprecatedUntilIso: new Date(untilMs).toISOString(),
        isDeprecatedWindowOpen(nowMs = Date.now()) {
            return nowMs <= untilMs;
        },
    };
}
