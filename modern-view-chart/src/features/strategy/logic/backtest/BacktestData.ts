import { Candle } from '@/lib/store/types';

export class BacktestData {
    static prepare(candles: Candle[]): Candle[] {
        // Ensure candles are sorted by time (Oldest first)
        return [...candles].sort((a, b) => {
            const getTime = (c: any) => {
                if (typeof c.time === 'number') return c.time;
                if (typeof c.time === 'string') return Date.parse(c.time) / 1000;
                return (c.time as any).timestamp || 0;
            };
            return getTime(a) - getTime(b);
        });
    }

    static getTimestamp(candle: Candle): number {
        let rawTime = 0;
        if (typeof candle.time === 'number') {
            rawTime = candle.time;
        } else if (typeof candle.time === 'string') {
            const parsed = Date.parse(candle.time);
            if (!isNaN(parsed)) rawTime = parsed;
        } else if (typeof candle.time === 'object') {
            rawTime = (candle.time as any).timestamp || 0;
        }

        // Normalization: Ensure we have Milliseconds
        return rawTime < 10000000000 ? rawTime * 1000 : rawTime;
    }
}
