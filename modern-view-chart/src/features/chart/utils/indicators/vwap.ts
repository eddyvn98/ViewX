import { Candle } from '@/lib/store/types';

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * Resets every daily session.
 */
export function calculateVWAP(candles: Candle[]): number[] {
    const len = candles.length;
    const vwap: number[] = new Array(len).fill(NaN);

    let cumulativePV = 0;
    let cumulativeVolume = 0;
    let lastDay = -1;

    for (let i = 0; i < len; i++) {
        const candle = candles[i];
        const time = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const date = new Date(time > 10000000000 ? time : time * 1000);
        const currentDay = date.getUTCDate();

        // Reset cumulative values on new day/session
        if (currentDay !== lastDay) {
            cumulativePV = 0;
            cumulativeVolume = 0;
            lastDay = currentDay;
        }

        const typicalPrice = (Number(candle.high) + Number(candle.low) + Number(candle.close)) / 3;
        const volume = Number(candle.volume || 0);

        cumulativePV += typicalPrice * volume;
        cumulativeVolume += volume;

        if (cumulativeVolume > 0) {
            vwap[i] = cumulativePV / cumulativeVolume;
        }
    }

    return vwap;
}
