import { calculateWMA } from './wma';

/**
 * Calculate Hull Moving Average (HMA)
 * HMA = WMA(2 * WMA(src, n/2) - WMA(src, n), sqrt(n))
 * Matches TradingView's ta.hma(src, length)
 */
export function calculateHullMA(data: number[], period: number): number[] {
    const len = data.length;
    const p = Math.max(2, Math.floor(Number(period)));

    // Pine Script uses floor for both according to official docs/built-ins
    const halfPeriod = Math.floor(p / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(p));

    const wmaHalf = calculateWMA(data, halfPeriod);
    const wmaFull = calculateWMA(data, p);

    const rawHma: number[] = new Array(len).fill(NaN);
    for (let i = 0; i < len; i++) {
        const vHalf = wmaHalf[i];
        const vFull = wmaFull[i];
        if (!isNaN(vHalf) && !isNaN(vFull)) {
            // HMA recursive projection: 2 * Fast - Slow
            rawHma[i] = (2 * vHalf) - vFull;
        }
    }

    return calculateWMA(rawHma, sqrtPeriod);
}
