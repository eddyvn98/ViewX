/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
    const p = Math.max(1, Math.floor(Number(period)));
    const sma: number[] = new Array(data.length).fill(NaN);
    if (data.length < p) return sma;

    let sum = 0;
    // Initial sum
    for (let i = 0; i < p; i++) sum += Number(data[i]);
    sma[p - 1] = sum / p;

    for (let i = p; i < data.length; i++) {
        sum = sum - Number(data[i - p]) + Number(data[i]);
        sma[i] = sum / p;
    }
    return sma;
}
