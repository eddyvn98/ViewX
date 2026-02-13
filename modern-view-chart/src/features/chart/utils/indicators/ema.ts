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
