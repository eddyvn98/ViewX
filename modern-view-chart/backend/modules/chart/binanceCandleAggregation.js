import { resolveBinanceInterval } from './binanceIntervals.js';

function yearStartUtcSec(timeSec) {
    const date = new Date(Number(timeSec) * 1000);
    return Date.UTC(date.getUTCFullYear(), 0, 1) / 1000;
}

function tenMinuteStartSec(timeSec) {
    return Math.floor(Number(timeSec) / 600) * 600;
}

function aggregateGroup(group, time) {
    if (!group.length) return null;
    return {
        time,
        open: Number(group[0].open),
        high: Math.max(...group.map((candle) => Number(candle.high))),
        low: Math.min(...group.map((candle) => Number(candle.low))),
        close: Number(group[group.length - 1].close),
        volume: group.reduce((sum, candle) => sum + Number(candle.volume || 0), 0),
    };
}

export function aggregateBinanceCandles(candles, interval) {
    const rows = Array.isArray(candles) ? candles : [];
    const plan = resolveBinanceInterval(interval);
    if (!plan.aggregate) return rows;

    const groups = new Map();
    for (const candle of rows) {
        const time = Number(candle?.time);
        if (!Number.isFinite(time)) continue;
        const bucket = plan.aggregate === '10m'
            ? tenMinuteStartSec(time)
            : yearStartUtcSec(time);
        const group = groups.get(bucket) || [];
        group.push(candle);
        groups.set(bucket, group);
    }

    return Array.from(groups.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([bucket, group]) => aggregateGroup(group, bucket))
        .filter(Boolean);
}

export function getBinanceAggregateBucketStart(timeSec, interval) {
    const plan = resolveBinanceInterval(interval);
    if (plan.aggregate === '10m') return tenMinuteStartSec(timeSec);
    if (plan.aggregate === '1Y') return yearStartUtcSec(timeSec);
    return Number(timeSec);
}
