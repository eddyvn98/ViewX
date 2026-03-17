import { Candle } from '@/lib/store/types';

const getTime = (candle: Candle): number => Number(candle.time);

export class BacktestData {
    static prepare(candles: Candle[]): Candle[] {
        // Ensure candles are sorted by time (Oldest first)
        return [...candles].sort((a, b) => getTime(a) - getTime(b));
    }

    static getTimestamp(candle: Candle): number {
        const rawTime = Number(candle.time);

        // Normalization: Ensure we have Milliseconds
        return rawTime < 10000000000 ? rawTime * 1000 : rawTime;
    }
}
