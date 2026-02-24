import { calculateSMA } from './sma';

export interface StochasticResult {
    k: number[];
    d: number[];
}

/**
 * Calculate Stochastic Oscillator
 * @param high Array of high prices
 * @param low Array of low prices
 * @param close Array of close prices
 * @param periodK Period for %K (default 14)
 * @param smoothK Smoothing for %K (default 3)
 * @param periodD Period for %D (default 3)
 */
export function calculateStochastic(
    high: number[],
    low: number[],
    close: number[],
    periodK: number = 14,
    smoothK: number = 3,
    periodD: number = 3
): StochasticResult {
    const len = close.length;
    const rawK: number[] = new Array(len).fill(NaN);

    for (let i = periodK - 1; i < len; i++) {
        const sliceHigh = high.slice(i - periodK + 1, i + 1);
        const sliceLow = low.slice(i - periodK + 1, i + 1);

        const highestHigh = Math.max(...sliceHigh);
        const lowestLow = Math.min(...sliceLow);

        if (highestHigh === lowestLow) {
            rawK[i] = 50; // Avoid division by zero
        } else {
            rawK[i] = ((close[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
        }
    }

    // Smooth %K
    const k = smoothK > 1 ? calculateSMA(rawK.map(v => isNaN(v) ? 0 : v), smoothK) : rawK;

    // %D is SMA of %K
    const d = calculateSMA(k.map(v => isNaN(v) ? 0 : v), periodD);

    // Restore NaNs for the initial period
    for (let i = 0; i < len; i++) {
        if (i < periodK - 1) k[i] = NaN;
        if (i < periodK + periodD - 2) d[i] = NaN;
    }

    return { k, d };
}
