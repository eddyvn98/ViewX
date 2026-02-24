import { Candle } from '@/lib/store/types';
import { calculateATR } from './atr';

export interface SuperTrendResult {
    trend: number[]; // 1 for bull, -1 for bear
    superTrend: number[];
}

/**
 * Calculate SuperTrend
 * @param candles Array of Candles
 * @param period ATR Period (default 10)
 * @param multiplier ATR Multiplier (default 3)
 */
export function calculateSuperTrend(
    candles: Candle[],
    period: number = 10,
    multiplier: number = 3
): SuperTrendResult {
    const len = candles.length;
    const trend: number[] = new Array(len).fill(0);
    const superTrend: number[] = new Array(len).fill(NaN);

    if (len < period) return { trend, superTrend };

    const atr = calculateATR(candles, period);

    const upperBand: number[] = new Array(len).fill(NaN);
    const lowerBand: number[] = new Array(len).fill(NaN);

    for (let i = 0; i < len; i++) {
        const hl2 = (Number(candles[i].high) + Number(candles[i].low)) / 2;
        upperBand[i] = hl2 + multiplier * atr[i];
        lowerBand[i] = hl2 - multiplier * atr[i];
    }

    // Final bands calculation logic with previous values
    const finalUpperBand: number[] = new Array(len).fill(NaN);
    const finalLowerBand: number[] = new Array(len).fill(NaN);

    // Initial values for the first valid period
    finalUpperBand[period - 1] = upperBand[period - 1];
    finalLowerBand[period - 1] = lowerBand[period - 1];
    trend[period - 1] = 1;

    for (let i = period; i < len; i++) {
        const close = Number(candles[i].close);
        const prevClose = Number(candles[i - 1].close);

        // Final Upper Band
        if (upperBand[i] < finalUpperBand[i - 1] || prevClose > finalUpperBand[i - 1]) {
            finalUpperBand[i] = upperBand[i];
        } else {
            finalUpperBand[i] = finalUpperBand[i - 1];
        }

        // Final Lower Band
        if (lowerBand[i] > finalLowerBand[i - 1] || prevClose < finalLowerBand[i - 1]) {
            finalLowerBand[i] = lowerBand[i];
        } else {
            finalLowerBand[i] = finalLowerBand[i - 1];
        }

        // Trend
        if (trend[i - 1] === 1 && close < finalLowerBand[i]) {
            trend[i] = -1;
        } else if (trend[i - 1] === -1 && close > finalUpperBand[i]) {
            trend[i] = 1;
        } else {
            trend[i] = trend[i - 1];
        }

        superTrend[i] = trend[i] === 1 ? finalLowerBand[i] : finalUpperBand[i];
    }

    return { trend, superTrend };
}
