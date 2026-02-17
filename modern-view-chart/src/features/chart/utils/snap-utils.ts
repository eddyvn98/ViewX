
import { ISeriesApi, Time } from 'lightweight-charts';
import { Candle } from '@/lib/store/types';

export interface SnapPoint {
    time: Time;
    price: number;
    type: 'high' | 'low' | 'open' | 'close';
    distance: number;
}

const toSeconds = (t: any): number => {
    if (!t) return 0;
    const n = typeof t === 'object' ? (t as any).timestamp : Number(t);
    return n > 10000000000 ? Math.floor(n / 1000) : n;
};

/**
 * Finds the nearest candle price level (H/L/O/C) to the target price
 * within a pixel-based threshold.
 */
export function findSnapPoint(
    mouseY: number,
    time: Time,
    candles: Candle[],
    series: ISeriesApi<any>,
    thresholdPx: number = 20
): SnapPoint | null {
    if (!candles || candles.length === 0 || !time) return null;

    // 1. Find the candle at this time
    const targetSeconds = toSeconds(time);
    const candle = candles.find(c => toSeconds(c.time) === targetSeconds);

    if (!candle) return null;

    const pricePoints = [
        { price: candle.high, type: 'high' },
        { price: candle.low, type: 'low' },
        { price: candle.open, type: 'open' },
        { price: candle.close, type: 'close' }
    ];

    let nearest: SnapPoint | null = null;
    let minDistance = thresholdPx;

    for (const p of pricePoints) {
        const coordinate = series.priceToCoordinate(p.price);
        if (coordinate === null) continue;

        const distance = Math.abs(coordinate - mouseY);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = {
                time,
                price: p.price,
                type: p.type as any,
                distance
            };
        }
    }

    return nearest;
}
