import { Candle } from '@/lib/store/types';

export interface IchimokuResult {
    tenkan: number[];
    kijun: number[];
    spanA: number[];
    spanB: number[];
    chikou: number[];
}

/**
 * Calculate Ichimoku Cloud
 * @param candles Array of Candles
 * @param tenkanPeriod default 9
 * @param kijunPeriod default 26
 * @param spanBPeriod default 52
 * @param displacement default 26 (for Spans and Chikou)
 */
export function calculateIchimoku(
    candles: Candle[],
    tenkanPeriod: number = 9,
    kijunPeriod: number = 26,
    spanBPeriod: number = 52,
    displacement: number = 26
): IchimokuResult {
    const len = candles.length;
    const high = candles.map(c => Number(c.high));
    const low = candles.map(c => Number(c.low));
    const close = candles.map(c => Number(c.close));

    const tenkan: number[] = new Array(len).fill(NaN);
    const kijun: number[] = new Array(len).fill(NaN);
    const spanA: number[] = new Array(len + displacement).fill(NaN);
    const spanB: number[] = new Array(len + displacement).fill(NaN);
    const chikou: number[] = new Array(len).fill(NaN);

    const getDonchian = (h: number[], l: number[], period: number, idx: number) => {
        if (idx < period - 1) return NaN;
        const sliceH = h.slice(idx - period + 1, idx + 1);
        const sliceL = l.slice(idx - period + 1, idx + 1);
        return (Math.max(...sliceH) + Math.min(...sliceL)) / 2;
    };

    for (let i = 0; i < len; i++) {
        tenkan[i] = getDonchian(high, low, tenkanPeriod, i);
        kijun[i] = getDonchian(high, low, kijunPeriod, i);

        // Span A is average of Tenkan and Kijun, displaced forward
        if (!isNaN(tenkan[i]) && !isNaN(kijun[i])) {
            spanA[i + displacement] = (tenkan[i] + kijun[i]) / 2;
        }

        // Span B is 52-period Donchian, displaced forward
        const sB = getDonchian(high, low, spanBPeriod, i);
        if (!isNaN(sB)) {
            spanB[i + displacement] = sB;
        }

        // Chikou is current close, displaced backward
        if (i >= displacement) {
            chikou[i - displacement] = close[i];
        }
    }

    return {
        tenkan,
        kijun,
        spanA: spanA.slice(0, len), // Keep it same length for now, logic handled in class
        spanB: spanB.slice(0, len),
        chikou
    };
}
