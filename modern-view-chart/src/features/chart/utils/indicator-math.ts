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
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
    const p = Math.max(1, Math.floor(Number(period)));
    const sma: number[] = new Array(data.length).fill(NaN);
    if (data.length < p) return sma;

    let sum = 0;
    for (let i = 0; i < p; i++) sum += Number(data[i]);
    sma[p - 1] = sum / p;

    for (let i = p; i < data.length; i++) {
        sum = sum - Number(data[i - p]) + Number(data[i]);
        sma[i] = sum / p;
    }
    return sma;
}

/**
 * Calculate Weighted Moving Average (WMA)
 * Matches TradingView's wma(src, length)
 */
export function calculateWMA(data: number[], period: number): number[] {
    const len = data.length;
    const p = Math.max(1, Math.floor(Number(period)));
    const wma: number[] = new Array(len).fill(NaN);
    if (len < p) return wma;

    const weightSum = (p * (p + 1)) / 2;

    for (let i = p - 1; i < len; i++) {
        let sum = 0;
        let isWindowValid = true;
        for (let j = 0; j < p; j++) {
            const val = data[i - j];
            if (val === null || val === undefined || isNaN(val)) {
                isWindowValid = false;
                break;
            }
            // Weight logic: j=0 (current) -> weight=p, j=p-1 (oldest) -> weight=1
            sum += val * (p - j);
        }
        if (isWindowValid) {
            wma[i] = sum / weightSum;
        }
    }
    return wma;
}

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

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(data: number[], period: number = 14): number[] {
    const p = Math.max(1, Math.floor(Number(period)));
    const rsi: number[] = new Array(data.length).fill(NaN);
    if (data.length < p + 1) return rsi;

    const gains: number[] = [0];
    const losses: number[] = [0];

    for (let i = 1; i < data.length; i++) {
        const diff = Number(data[i]) - Number(data[i - 1]);
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }

    // Initial SMA for Gains and Losses
    let avgGain = gains.slice(1, p + 1).reduce((a, b) => a + b, 0) / p;
    let avgLoss = losses.slice(1, p + 1).reduce((a, b) => a + b, 0) / p;

    if (avgLoss === 0) rsi[p] = 100;
    else rsi[p] = 100 - (100 / (1 + avgGain / avgLoss));

    // Wilders smoothing (EWM alpha=1/period)
    for (let i = p + 1; i < data.length; i++) {
        avgGain = (avgGain * (p - 1) + gains[i]) / p;
        avgLoss = (avgLoss * (p - 1) + losses[i]) / p;

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
    let prevHaOpen = Number(candles[0].open);
    let prevHaClose = (Number(candles[0].open) + Number(candles[0].high) + Number(candles[0].low) + Number(candles[0].close)) / 4;

    result.push({
        ...candles[0],
        ha_open: prevHaOpen,
        ha_close: prevHaClose,
        ha_high: Number(candles[0].high),
        ha_low: Number(candles[0].low)
    });

    for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);
        const close = Number(c.close);

        const haClose = (open + high + low + close) / 4;
        const haOpen = (prevHaOpen + prevHaClose) / 2;
        const haHigh = Math.max(high, haOpen, haClose);
        const haLow = Math.min(low, haOpen, haClose);

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
