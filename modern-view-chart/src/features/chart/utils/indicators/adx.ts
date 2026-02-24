import { Candle } from '@/lib/store/types';

export interface ADXResult {
    adx: number[];
    plusDI: number[];
    minusDI: number[];
}

/**
 * Calculate ADX (Average Directional Index)
 */
export function calculateADX(candles: Candle[], period: number = 14): ADXResult {
    const len = candles.length;
    const adx: number[] = new Array(len).fill(NaN);
    const plusDI: number[] = new Array(len).fill(NaN);
    const minusDI: number[] = new Array(len).fill(NaN);

    if (len < period * 2) return { adx, plusDI, minusDI };

    const tr: number[] = new Array(len).fill(0);
    const plusDM: number[] = new Array(len).fill(0);
    const minusDM: number[] = new Array(len).fill(0);

    for (let i = 1; i < len; i++) {
        const h = Number(candles[i].high);
        const l = Number(candles[i].low);
        const ph = Number(candles[i - 1].high);
        const pl = Number(candles[i - 1].low);
        const pc = Number(candles[i - 1].close);

        tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

        const diffH = h - ph;
        const diffL = pl - l;

        if (diffH > diffL && diffH > 0) {
            plusDM[i] = diffH;
        } else {
            plusDM[i] = 0;
        }

        if (diffL > diffH && diffL > 0) {
            minusDM[i] = diffL;
        } else {
            minusDM[i] = 0;
        }
    }

    // Smoothed values (Wilder's)
    let smoothTR = 0;
    let smoothPlusDM = 0;
    let smoothMinusDM = 0;

    for (let i = 0; i < period; i++) {
        smoothTR += tr[i];
        smoothPlusDM += plusDM[i];
        smoothMinusDM += minusDM[i];
    }

    const dx: number[] = new Array(len).fill(NaN);

    for (let i = period; i < len; i++) {
        smoothTR = smoothTR - (smoothTR / period) + tr[i];
        smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[i];
        smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[i];

        const pDI = (smoothPlusDM / smoothTR) * 100;
        const mDI = (smoothMinusDM / smoothTR) * 100;

        plusDI[i] = pDI;
        minusDI[i] = mDI;

        const diff = Math.abs(pDI - mDI);
        const sum = pDI + mDI;
        dx[i] = sum === 0 ? 0 : (diff / sum) * 100;
    }

    // Calculate ADX (SMA of DX)
    let dxSum = 0;
    for (let i = period; i < period * 2; i++) {
        dxSum += dx[i];
    }

    adx[period * 2 - 1] = dxSum / period;

    for (let i = period * 2; i < len; i++) {
        adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
    }

    return { adx, plusDI, minusDI };
}
