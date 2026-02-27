function parseBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
}

function parseIntEnv(value, fallback) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const enabled = parseBooleanEnv(process.env.EMERGENCY_MODE, false);

export const emergencyConfig = {
    enabled,
    blockHeavyHttp: parseBooleanEnv(process.env.EMERGENCY_BLOCK_HEAVY_HTTP, true),
    blockTrading: parseBooleanEnv(process.env.EMERGENCY_BLOCK_TRADING, true),
    limits: {
        apiPerMin: enabled ? parseIntEnv(process.env.EMERGENCY_API_LIMIT_PER_MIN, 80) : 300,
        aiPerMin: enabled ? parseIntEnv(process.env.EMERGENCY_AI_LIMIT_PER_MIN, 4) : 30,
        aiTaskPerMin: enabled ? parseIntEnv(process.env.EMERGENCY_AI_TASK_LIMIT_PER_MIN, 2) : 12,
        marketPerMin: enabled ? parseIntEnv(process.env.EMERGENCY_MARKET_LIMIT_PER_MIN, 20) : 120,
        wsClients: enabled
            ? parseIntEnv(process.env.EMERGENCY_MAX_WS_CLIENTS, 40)
            : parseIntEnv(process.env.MAX_WS_CLIENTS, 150),
        wsMsgPer10s: enabled
            ? parseIntEnv(process.env.EMERGENCY_WS_MSG_RATE_PER_10S, 30)
            : parseIntEnv(process.env.WS_MSG_RATE_PER_10S, 60),
        bridgeWsMsgPer10s: enabled
            ? parseIntEnv(process.env.EMERGENCY_BRIDGE_WS_MSG_RATE_PER_10S, 4000)
            : parseIntEnv(process.env.BRIDGE_WS_MSG_RATE_PER_10S, 15000),
        wsBroadcastIntervalMs: enabled
            ? parseIntEnv(process.env.EMERGENCY_WS_BROADCAST_INTERVAL_MS, 1500)
            : 1000,
        binanceBroadcastIntervalMs: enabled
            ? parseIntEnv(process.env.EMERGENCY_BINANCE_BROADCAST_INTERVAL_MS, 2000)
            : 1000,
    },
};

