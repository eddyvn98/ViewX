import type { ITimeScaleApi, Time } from 'lightweight-charts';
import type { LogicalRangeSource, PersistedRange } from '../chart-init-helpers';
import { logicalRangesEqual, sanitizeRange } from '../chart-init-helpers';

type LogicalRangeSyncDeps = {
    priceTS: ITimeScaleApi<Time>;
    subTS: ITimeScaleApi<Time>;
    footTS: ITimeScaleApi<Time>;
    scheduleViewportPersist: () => void;
    getIsPointerInteracting: () => boolean;
    getPointerInteractionSource: () => LogicalRangeSource | null;
};

export const shouldAcceptLogicalRangeSource = (
    source: LogicalRangeSource,
    isPointerInteracting: boolean,
    pointerInteractionSource: LogicalRangeSource | null,
): boolean => {
    if (source === 'price') return true;
    return isPointerInteracting && pointerInteractionSource === source;
};

export type LogicalRangeSync = {
    queueLogicalRangeSync: (range: unknown, source: LogicalRangeSource) => void;
    flushLogicalRangeSync: () => void;
    cancelPendingLogicalRangeSync: () => void;
    setLastAppliedLogicalRange: (range: PersistedRange | null) => void;
    dispose: () => void;
};

export function createLogicalRangeSync({
    priceTS,
    subTS,
    footTS,
    scheduleViewportPersist,
    getIsPointerInteracting,
    getPointerInteractionSource,
}: LogicalRangeSyncDeps): LogicalRangeSync {
    let pendingLogicalRange: PersistedRange | null = null;
    let pendingLogicalRangeSource: LogicalRangeSource | null = null;
    let lastAppliedLogicalRange: PersistedRange | null = null;
    let logicalRangeSyncRafId: number | null = null;
    let syncing = false;

    const applyLogicalRangeToTargets = (nextRange: PersistedRange, source: LogicalRangeSource | null) => {
        if (source !== 'price') priceTS.setVisibleLogicalRange(nextRange);
        if (source !== 'sub') subTS.setVisibleLogicalRange(nextRange);
        if (source !== 'foot') footTS.setVisibleLogicalRange(nextRange);
    };

    const flushLogicalRangeSync = () => {
        if (!pendingLogicalRange || syncing) return;
        const nextRange = pendingLogicalRange;
        const nextSource = pendingLogicalRangeSource;
        pendingLogicalRange = null;
        pendingLogicalRangeSource = null;
        logicalRangeSyncRafId = null;
        if (logicalRangesEqual(nextRange, lastAppliedLogicalRange)) return;

        syncing = true;
        applyLogicalRangeToTargets(nextRange, nextSource);
        syncing = false;
        lastAppliedLogicalRange = nextRange;
        scheduleViewportPersist();
    };

    const queueLogicalRangeSync = (range: unknown, source: LogicalRangeSource) => {
        const nextRange = sanitizeRange(range as PersistedRange | null);
        if (!nextRange || syncing) return;
        const isPointerInteracting = getIsPointerInteracting();
        const pointerInteractionSource = getPointerInteractionSource();

        // The price chart is the canonical viewport. Subchart/footer may only
        // drive the range while the user is actively manipulating that exact pane.
        // This prevents resize/setData events from a secondary chart from pushing
        // a transient logical range back into the price chart.
        if (!shouldAcceptLogicalRangeSource(source, isPointerInteracting, pointerInteractionSource)) return;
        if (
            logicalRangesEqual(nextRange, pendingLogicalRange) ||
            logicalRangesEqual(nextRange, lastAppliedLogicalRange)
        ) {
            return;
        }
        pendingLogicalRange = nextRange;
        pendingLogicalRangeSource = source;
        if (logicalRangeSyncRafId !== null) return;
        logicalRangeSyncRafId = requestAnimationFrame(flushLogicalRangeSync);
    };

    const cancelPendingLogicalRangeSync = () => {
        if (logicalRangeSyncRafId !== null) {
            cancelAnimationFrame(logicalRangeSyncRafId);
            logicalRangeSyncRafId = null;
        }
    };

    const setLastAppliedLogicalRange = (range: PersistedRange | null) => {
        lastAppliedLogicalRange = range;
    };

    const dispose = () => {
        cancelPendingLogicalRangeSync();
        pendingLogicalRange = null;
        pendingLogicalRangeSource = null;
    };

    return {
        queueLogicalRangeSync,
        flushLogicalRangeSync,
        cancelPendingLogicalRangeSync,
        setLastAppliedLogicalRange,
        dispose,
    };
}
