export const INITIAL_HISTORY_COUNT = 300;
export const MAX_INCREMENTAL_HISTORY_COUNT = 5000;
export const HISTORY_OVERLAP_BARS = 2;

export function getIncrementalHistoryCount(
    lastTimeSec: number | null | undefined,
    nowSec: number,
    intervalSec: number,
    options?: {
        initialCount?: number;
        maxCount?: number;
        overlapBars?: number;
    },
): number {
    const initialCount = Math.max(1, Math.floor(options?.initialCount ?? INITIAL_HISTORY_COUNT));
    const maxCount = Math.max(initialCount, Math.floor(options?.maxCount ?? MAX_INCREMENTAL_HISTORY_COUNT));
    const overlapBars = Math.max(0, Math.floor(options?.overlapBars ?? HISTORY_OVERLAP_BARS));

    if (!Number.isFinite(lastTimeSec) || Number(lastTimeSec) <= 0) return initialCount;
    if (!Number.isFinite(nowSec) || !Number.isFinite(intervalSec) || intervalSec <= 0) return initialCount;

    const gapSec = Math.max(0, nowSec - Number(lastTimeSec));
    if (gapSec < intervalSec) return 0;

    const missingBars = Math.max(1, Math.floor(gapSec / intervalSec));
    return Math.min(maxCount, missingBars + overlapBars);
}
