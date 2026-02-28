import { Candle } from '@/lib/store';

export const formatCandles = (candles: Candle[]) =>
    candles.map(c => ({
        ...c,
        time: (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time)) as any,
    }));

export function getIntervalSeconds(interval?: string): number {
    if (!interval) return 60;
    const unit = interval.slice(-1);
    const val = parseInt(interval, 10);
    if (unit === 'm') return val * 60;
    if (unit === 'h' || unit === 'H') return val * 3600;
    if (unit === 'd' || unit === 'D') return val * 86400;
    if (unit === 'w' || unit === 'W') return val * 604800;
    if (!isNaN(Number(interval))) return Number(interval) * 60;
    return 60;
}

export function buildLiveCandle(baseCandle: any, price: number, interval?: string) {
    const intervalSeconds = getIntervalSeconds(interval);
    const lastCandleTime = typeof baseCandle.time === 'object' ? (baseCandle.time as any).timestamp : Number(baseCandle.time);
    const isMillis = lastCandleTime > 10000000000;
    const lastCandleTimeSec = isMillis ? Math.floor(lastCandleTime / 1000) : lastCandleTime;

    const nowSec = Math.floor(Date.now() / 1000);
    const currentIntervalStartSec = Math.floor(nowSec / intervalSeconds) * intervalSeconds;

    if (currentIntervalStartSec > lastCandleTimeSec) {
        const newTime = isMillis ? currentIntervalStartSec * 1000 : currentIntervalStartSec;
        return { time: newTime as any, open: price, high: price, low: price, close: price, volume: 0 };
    }

    return {
        ...baseCandle,
        close: price,
        high: Math.max(baseCandle.high || price, price),
        low: Math.min(baseCandle.low || price, price),
    };
}
