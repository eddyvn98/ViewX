import { Candle } from '@/lib/store/types';

/**
 * Calculate Parabolic SAR (Stop and Reverse)
 * @param candles Array of candle data
 * @param startAF Initial acceleration factor (default 0.02)
 * @param incrementAF Increment for acceleration factor (default 0.02)
 * @param maxAF Maximum acceleration factor (default 0.20)
 * @returns Array of SAR values
 */
export function calculateSAR(
    candles: Candle[],
    startAF: number = 0.02,
    incrementAF: number = 0.02,
    maxAF: number = 0.20
): number[] {
    const sar: number[] = new Array(candles.length).fill(NaN);
    if (candles.length < 2) return sar;

    // Initial trend detection based on first two bars
    let isBullish = candles[1].close > candles[0].close;
    let af = startAF;
    let ep = isBullish ? candles[0].high : candles[0].low;
    let lastSar = isBullish ? candles[0].low : candles[0].high;

    sar[0] = lastSar;

    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;

        // Calculate next SAR based on previous values
        let currentSar = lastSar + af * (ep - lastSar);

        if (isBullish) {
            // SAR cannot be higher than the lows of the previous two periods
            const prevLow1 = candles[i - 1]?.low || low;
            const prevLow2 = i > 1 ? candles[i - 2].low : prevLow1;
            currentSar = Math.min(currentSar, prevLow1, prevLow2);

            // Reversal condition
            if (low < currentSar) {
                isBullish = false;
                currentSar = ep; // New SAR is the previous EP
                ep = low;
                af = startAF;
            } else {
                // Update EP and AF
                if (high > ep) {
                    ep = high;
                    af = Math.min(af + incrementAF, maxAF);
                }
            }
        } else {
            // SAR cannot be lower than the highs of the previous two periods
            const prevHigh1 = candles[i - 1]?.high || high;
            const prevHigh2 = i > 1 ? candles[i - 2].high : prevHigh1;
            currentSar = Math.max(currentSar, prevHigh1, prevHigh2);

            // Reversal condition
            if (high > currentSar) {
                isBullish = true;
                currentSar = ep; // New SAR is the previous EP
                ep = high;
                af = startAF;
            } else {
                // Update EP and AF
                if (low < ep) {
                    ep = low;
                    af = Math.min(af + incrementAF, maxAF);
                }
            }
        }

        sar[i] = currentSar;
        lastSar = currentSar;
    }

    return sar;
}
