import { MACDResult } from '@/features/strategy/types';
import { calculateEMA } from './ema';

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult {
    const macd: number[] = new Array(data.length).fill(NaN);
    const signal: number[] = new Array(data.length).fill(NaN);
    const histogram: number[] = new Array(data.length).fill(NaN);

    if (data.length < slowPeriod) return { macd, signal, histogram };

    const emaFast = calculateEMA(data, fastPeriod);
    const emaSlow = calculateEMA(data, slowPeriod);

    // Calculate MACD Line
    for (let i = 0; i < data.length; i++) {
        if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
            macd[i] = emaFast[i] - emaSlow[i];
        }
    }

    // Calculate Signal Line (EMA of MACD)
    // We need to filter out initial NaNs from MACD to calculate its EMA correctly
    const firstValidMacdIdx = macd.findIndex(v => !isNaN(v));
    if (firstValidMacdIdx !== -1) {
        // Calculate Signal on the valid MACD slice
        const validMacd = macd.slice(firstValidMacdIdx);
        const signalSlice = calculateEMA(validMacd, signalPeriod);

        // Map back to original indices
        for (let i = 0; i < signalSlice.length; i++) {
            signal[firstValidMacdIdx + i] = signalSlice[i];
        }
    }

    // Calculate Histogram
    for (let i = 0; i < data.length; i++) {
        if (!isNaN(macd[i]) && !isNaN(signal[i])) {
            histogram[i] = macd[i] - signal[i];
        }
    }

    return { macd, signal, histogram };
}
