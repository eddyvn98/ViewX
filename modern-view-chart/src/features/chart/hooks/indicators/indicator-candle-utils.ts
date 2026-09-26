import { Candle } from '@/lib/store';

type CandleTimeLike = number | { timestamp?: number };
type CandleWithTimeLike = Omit<Candle, 'time'> & { time: CandleTimeLike };

const toNumericTime = (time: CandleTimeLike): number =>
    typeof time === 'object' ? Number(time.timestamp ?? 0) : Number(time);

export const formatCandles = (candles: Candle[]) =>
    candles.map(c => ({
        ...c,
        time: toNumericTime(c.time as CandleTimeLike),
    }));

export function getIntervalSeconds(interval?: string): number {
    if (!interval) return 60;
    const raw = String(interval).trim();
    if (!raw) return 60;
    if (/^\d+$/.test(raw)) return Number(raw) * 60;

    const m = raw.match(/^(\d+)?\s*([mhdw])$/i);
    if (!m) return 60;

    const unit = m[2].toLowerCase();
    const val = m[1] ? Number(m[1]) : 1;
    if (!Number.isFinite(val) || val <= 0) return 60;

    if (unit === 'm') return val * 60;
    if (unit === 'h') return val * 3600;
    if (unit === 'd') return val * 86400;
    if (unit === 'w') return val * 604800;
    return 60;
}

export function buildLiveCandle(baseCandle: CandleWithTimeLike, price: number, interval?: string): Candle {
    const intervalSeconds = getIntervalSeconds(interval);
    const lastCandleTime = toNumericTime(baseCandle.time);
    const isMillis = lastCandleTime > 10000000000;
    const lastCandleTimeSec = isMillis ? Math.floor(lastCandleTime / 1000) : lastCandleTime;

    const nowSec = Math.floor(Date.now() / 1000);
    const currentIntervalStartSec = Math.floor(nowSec / intervalSeconds) * intervalSeconds;

    if (currentIntervalStartSec > lastCandleTimeSec) {
        const newTime = isMillis ? currentIntervalStartSec * 1000 : currentIntervalStartSec;
        return { time: newTime, open: price, high: price, low: price, close: price, volume: 0 };
    }

    return {
        ...baseCandle,
        time: toNumericTime(baseCandle.time),
        close: price,
        high: Math.max(baseCandle.high || price, price),
        low: Math.min(baseCandle.low || price, price),
    };
}
