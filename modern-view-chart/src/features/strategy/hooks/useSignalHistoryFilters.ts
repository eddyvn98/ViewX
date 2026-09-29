import React from 'react';
import type { MatrixScannerConfig } from '@/features/strategy/dashboard/matrix-types';
import type { StrategySignal } from '@/features/strategy/types';
import type { GroupedSignals, SignalRange, SignalWithIndex } from '@/features/strategy/components/signals-view/types';

interface UseSignalHistoryFiltersInput {
    signals: StrategySignal[];
    matrixScanners: MatrixScannerConfig[];
    selectedRange: SignalRange;
}

interface UseSignalHistoryFiltersResult {
    scannerStrategyIds: Set<string>;
    visibleSignals: SignalWithIndex[];
    groupedSignals: GroupedSignals;
    filteredSignals: SignalWithIndex[];
}

export function useSignalHistoryFilters({
    signals,
    matrixScanners,
    selectedRange,
}: UseSignalHistoryFiltersInput): UseSignalHistoryFiltersResult {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const refreshNow = () => setNow(Date.now());
        refreshNow();
        const timer = window.setInterval(refreshNow, 60_000);
        return () => window.clearInterval(timer);
    }, [signals, matrixScanners]);

    const scannerStrategyIds = React.useMemo(
        () => new Set(matrixScanners.map((scanner) => scanner.strategyId).filter(Boolean) as string[]),
        [matrixScanners]
    );

    const visibleSignals = React.useMemo(
        () =>
            signals
                .map((sig, index) => ({ sig, index }))
                .filter(({ sig }) => scannerStrategyIds.size === 0 || scannerStrategyIds.has(sig.strategyId)),
        [signals, scannerStrategyIds]
    );

    const groupedSignals = React.useMemo<GroupedSignals>(() => {
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;
        const monthMs = 30 * dayMs;

        const sorted = [...visibleSignals].sort(
            (a, b) => new Date(b.sig.timestamp).getTime() - new Date(a.sig.timestamp).getTime()
        );

        return {
            day: sorted.filter(({ sig }) => now - new Date(sig.timestamp).getTime() <= dayMs).slice(0, 8),
            week: sorted.filter(({ sig }) => now - new Date(sig.timestamp).getTime() <= weekMs).slice(0, 8),
            month: sorted.filter(({ sig }) => now - new Date(sig.timestamp).getTime() <= monthMs).slice(0, 8),
        };
    }, [now, visibleSignals]);

    return {
        scannerStrategyIds,
        visibleSignals,
        groupedSignals,
        filteredSignals: groupedSignals[selectedRange],
    };
}
