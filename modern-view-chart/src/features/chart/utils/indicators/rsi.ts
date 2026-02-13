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
