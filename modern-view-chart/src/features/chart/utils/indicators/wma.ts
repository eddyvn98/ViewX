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
