import tradeLogModel from "../../model/trade_log.js";

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value) {
    const candidate = value ? new Date(value) : new Date();
    return Number.isNaN(candidate.getTime()) ? new Date() : candidate;
}

export function sanitizeTradeLogPayload(input) {
    const source = input && typeof input === "object" ? input : {};
    const indicators =
        source.indicators && typeof source.indicators === "object" && !Array.isArray(source.indicators)
            ? source.indicators
            : {};

    return {
        strategy_id: String(source.strategy_id || "").trim(),
        symbol: String(source.symbol || "").trim(),
        type: String(source.type || "BUY").trim().toUpperCase() === "SELL" ? "SELL" : "BUY",
        entry_price: toFiniteNumber(source.entry_price),
        exit_price: toNullableNumber(source.exit_price),
        lot_size: Math.max(toFiniteNumber(source.lot_size, 0), 0),
        pnl: toNullableNumber(source.pnl),
        mae: toNullableNumber(source.mae),
        mfe: toNullableNumber(source.mfe),
        volatility: String(source.volatility || "low").trim() || "low",
        session: String(source.session || "Unknown").trim() || "Unknown",
        indicators,
        exit_reason: source.exit_reason ? String(source.exit_reason).trim() : null,
        timestamp: normalizeTimestamp(source.timestamp),
    };
}

export function buildEmptyTradeStats() {
    return {
        overallWinrate: 0,
        buyWinrate: 0,
        sellWinrate: 0,
        recentWinrate: 0,
        avgMae: 0,
        avgMfe: 0,
        winrateByVolatility: {},
        winrateBySession: {},
        trendWinrate: 0,
        rangeWinrate: 0,
        recentPerformance: { wins: 0, losses: 0, total: 0 },
        sampleSize: 0,
    };
}

function groupByWinrate(logs, key) {
    const groups = {};
    for (const log of logs) {
        const value = String(log?.[key] || "unknown");
        if (!groups[value]) groups[value] = { total: 0, wins: 0 };
        groups[value].total += 1;
        if (toFiniteNumber(log?.pnl, 0) > 0) groups[value].wins += 1;
    }

    return Object.fromEntries(
        Object.entries(groups).map(([name, group]) => [name, group.total > 0 ? group.wins / group.total : 0]),
    );
}

export async function computeTradeStats(strategyId) {
    const normalizedStrategyId = String(strategyId || "").trim();
    if (!normalizedStrategyId) return buildEmptyTradeStats();

    const logs = await tradeLogModel
        .find({
            strategy_id: normalizedStrategyId,
            pnl: { $ne: null },
        })
        .sort({ timestamp: -1 })
        .lean();

    if (!logs.length) return buildEmptyTradeStats();

    const wins = logs.filter((log) => toFiniteNumber(log.pnl, 0) > 0);
    const buyLogs = logs.filter((log) => log.type === "BUY");
    const sellLogs = logs.filter((log) => log.type === "SELL");
    const trendLogs = logs.filter((log) => toFiniteNumber(log?.indicators?.trendStrength, 0) >= 25);
    const rangeLogs = logs.filter((log) => toFiniteNumber(log?.indicators?.trendStrength, 0) < 25);
    const recentLogs = logs.slice(0, 10);
    const recentWins = recentLogs.filter((log) => toFiniteNumber(log.pnl, 0) > 0).length;

    let totalMae = 0;
    let totalMfe = 0;
    let countWithExcursion = 0;

    for (const log of logs) {
        const mae = toNullableNumber(log.mae);
        const mfe = toNullableNumber(log.mfe);
        if (mae !== null || mfe !== null) {
            totalMae += mae || 0;
            totalMfe += mfe || 0;
            countWithExcursion += 1;
        }
    }

    return {
        overallWinrate: wins.length / logs.length,
        buyWinrate: buyLogs.length > 0 ? buyLogs.filter((log) => toFiniteNumber(log.pnl, 0) > 0).length / buyLogs.length : 0,
        sellWinrate: sellLogs.length > 0 ? sellLogs.filter((log) => toFiniteNumber(log.pnl, 0) > 0).length / sellLogs.length : 0,
        recentWinrate: recentLogs.length > 0 ? recentWins / recentLogs.length : 0,
        avgMae: countWithExcursion > 0 ? totalMae / countWithExcursion : 0,
        avgMfe: countWithExcursion > 0 ? totalMfe / countWithExcursion : 0,
        winrateByVolatility: groupByWinrate(logs, "volatility"),
        winrateBySession: groupByWinrate(logs, "session"),
        trendWinrate: trendLogs.length > 0 ? trendLogs.filter((log) => toFiniteNumber(log.pnl, 0) > 0).length / trendLogs.length : 0,
        rangeWinrate: rangeLogs.length > 0 ? rangeLogs.filter((log) => toFiniteNumber(log.pnl, 0) > 0).length / rangeLogs.length : 0,
        recentPerformance: {
            wins: recentWins,
            losses: recentLogs.length - recentWins,
            total: recentLogs.length,
        },
        sampleSize: logs.length,
    };
}
