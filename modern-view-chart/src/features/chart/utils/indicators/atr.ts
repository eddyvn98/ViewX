import { Candle } from '@/lib/store/types';

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
    const len = candles.length;
    const atr: number[] = new Array(len).fill(NaN);
    if (len < 2) return atr;

    const tr: number[] = new Array(len).fill(0);

    // First TR is just high - low
    tr[0] = Number(candles[0].high) - Number(candles[0].low);

    for (let i = 1; i < len; i++) {
        const h = Number(candles[i].high);
        const l = Number(candles[i].low);
        const pc = Number(candles[i - 1].close);
        tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }

    // Initial ATR is SMA of TR
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += tr[i];
    }
    atr[period - 1] = sum / period;

    // Wilder's Smoothing
    for (let i = period; i < len; i++) {
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }

    return atr;
}
