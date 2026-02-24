import { calculateSMA } from './sma';

export interface BollingerBandsResult {
    middle: number[];
    upper: number[];
    lower: number[];
}

/**
 * Calculate Bollinger Bands
 * @param prices Array of prices (usually close)
 * @param period Period for SMA and Standard Deviation (default 20)
 * @param stdDev Standard Deviation multiplier (default 2)
 */
export function calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
): BollingerBandsResult {
    const len = prices.length;
    const middle = calculateSMA(prices, period);
    const upper: number[] = new Array(len).fill(NaN);
    const lower: number[] = new Array(len).fill(NaN);

    for (let i = period - 1; i < len; i++) {
        // Calculate Standard Deviation
        let sum = 0;
        const avg = middle[i];

        for (let j = i - period + 1; j <= i; j++) {
            const diff = prices[j] - avg;
            sum += diff * diff;
        }

        const standardDeviation = Math.sqrt(sum / period);
        upper[i] = avg + stdDev * standardDeviation;
        lower[i] = avg - stdDev * standardDeviation;
    }

    return { middle, upper, lower };
}
