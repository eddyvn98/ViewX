import { Candle } from '@/lib/store/types';

export interface IndicatorData {
    time: number;
    value: number;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = new Array(data.length).fill(NaN);
    if (data.length < period) return ema;

    const alpha = 2 / (period + 1);

    // Initial SMA for first EMA point
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    ema[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * alpha + ema[i - 1];
    }

    return ema;
}

/**
 * Calculate Weighted Moving Average (WMA)
 */
export function calculateWMA(data: number[], period: number): number[] {
    const wma: number[] = new Array(data.length).fill(NaN);
    if (data.length < period) return wma;

    const weightSum = (period * (period + 1)) / 2;

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j] * (period - j);
        }
        wma[i] = sum / weightSum;
    }

    return wma;
}

/**
 * Calculate Hull Moving Average (HMA)
 * HMA = WMA(2*WMA(n/2) - WMA(n)), sqrt(n))
 */
export function calculateHullMA(data: number[], period: number): number[] {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const wmaHalf = calculateWMA(data, halfPeriod);
    const wmaFull = calculateWMA(data, period);

    const rawHma: number[] = new Array(data.length).fill(NaN);
    for (let i = 0; i < data.length; i++) {
        if (!isNaN(wmaHalf[i]) && !isNaN(wmaFull[i])) {
            rawHma[i] = 2 * wmaHalf[i] - wmaFull[i];
        }
    }

    // Filter out leading NaNs from rawHma for the second WMA
    const firstValidIdx = rawHma.findIndex(v => !isNaN(v));
    if (firstValidIdx === -1) return new Array(data.length).fill(NaN);

    const result = calculateWMA(rawHma.slice(firstValidIdx), sqrtPeriod);

    // Prepend the NaNs back
    const finalHma = new Array(firstValidIdx).fill(NaN).concat(result);
    return finalHma;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(data: number[], period: number = 14): number[] {
    const rsi: number[] = new Array(data.length).fill(NaN);
    if (data.length < period + 1) return rsi;

    const gains: number[] = [0];
    const losses: number[] = [0];

    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }

    // Initial SMA for Gains and Losses
    let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) rsi[period] = 100;
    else rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));

    // Wilders smoothing (EWM alpha=1/period)
    for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

        if (avgLoss === 0) rsi[i] = 100;
        else rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }

    return rsi;
}

/**
 * Calculate Heikin Ashi Candles
 */
export interface HACandle extends Candle {
    ha_open: number;
    ha_high: number;
    ha_low: number;
    ha_close: number;
}

export function calculateHeikinAshi(candles: Candle[]): HACandle[] {
    if (candles.length === 0) return [];

    const result: HACandle[] = [];

    // Initial HA Open is regular Open
    let prevHaOpen = candles[0].open;
    let prevHaClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;

    result.push({
        ...candles[0],
        ha_open: prevHaOpen,
        ha_close: prevHaClose,
        ha_high: candles[0].high,
        ha_low: candles[0].low
    });

    for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        const haOpen = (prevHaOpen + prevHaClose) / 2;
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);

        result.push({
            ...c,
            ha_open: haOpen,
            ha_close: haClose,
            ha_high: haHigh,
            ha_low: haLow
        });

        prevHaOpen = haOpen;
        prevHaClose = haClose;
    }

    return result;
}

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 */
export interface MACDResult {
    macd: number[];
    signal: number[];
    histogram: number[];
}

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
