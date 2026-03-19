import type { RootState } from '@/lib/store';
import type { StrategyState } from '@/features/strategy/store/strategy-store.types';
import type { TradeContext } from '@/features/strategy/types';
import { isPlainObject } from './tabs-utils';
import type { PersistedStrategyState } from './types';

export function trimIndicatorsSnapshot(input: unknown, limit = 24): Record<string, unknown> {
    if (!isPlainObject(input)) return {};
    return Object.fromEntries(Object.entries(input).slice(0, limit));
}

export function trimTradeContext(input: unknown): TradeContext | undefined {
    if (!isPlainObject(input)) return undefined;

    const next: Record<string, unknown> = { ...input };
    next.indicators_snapshot = trimIndicatorsSnapshot(input.indicators_snapshot);
    if (isPlainObject(input.post_exit)) {
        next.post_exit = Object.fromEntries(Object.entries(input.post_exit).slice(0, 12));
    }
    return next as unknown as TradeContext;
}

export function trimDrawings(drawings: RootState['chartDrawings']): RootState['chartDrawings'] {
    const next: RootState['chartDrawings'] = {};
    for (const [chartId, items] of Object.entries(drawings || {})) {
        if (!Array.isArray(items)) continue;
        next[chartId] = items.slice(-50).map((drawing) => ({
            ...drawing,
            points: Array.isArray(drawing.points) ? drawing.points.slice(0, 12) : [],
            params: isPlainObject(drawing.params)
                ? Object.fromEntries(Object.entries(drawing.params).slice(0, 20))
                : drawing.params,
        }));
    }
    return next;
}

export function trimStrategyState(strategy: PersistedStrategyState, aggressive = false): PersistedStrategyState {
    const openPositions = strategy.virtualPositions.filter((position) => position.status !== 'closed');
    const closedPositions = strategy.virtualPositions.filter((position) => position.status === 'closed');
    const keptClosedPositions = aggressive ? [] : closedPositions.slice(0, 20);
    const keptSignals = aggressive ? [] : strategy.signals.slice(0, 20);
    const keptScopedLastSignalTimes = Object.fromEntries(
        Object.entries(strategy.scopedLastSignalTimes || {}).slice(0, aggressive ? 25 : 100),
    );

    return {
        ...strategy,
        signals: keptSignals.map((signal) => ({
            ...signal,
            aiAnalysis: signal.aiAnalysis
                ? {
                    confidence: signal.aiAnalysis.confidence,
                    riskLevel: signal.aiAnalysis.riskLevel,
                    reasoning: Array.isArray(signal.aiAnalysis.reasoning)
                        ? signal.aiAnalysis.reasoning.slice(0, 3)
                        : [],
                    suggestedFix: signal.aiAnalysis.suggestedFix,
                }
                : undefined,
            context: trimTradeContext(signal.context),
        })),
        virtualPositions: [...openPositions, ...keptClosedPositions].map((position) => ({
            ...position,
            metadata: trimTradeContext(position.metadata),
        })),
        matrixScanners: strategy.matrixScanners.slice(0, aggressive ? 4 : 12),
        scopedLastSignalTimes: keptScopedLastSignalTimes,
    };
}

export function hasUsableMatrixScanner(
    scanners: Partial<PersistedStrategyState['matrixScanners'][number]>[] | undefined,
): boolean {
    if (!Array.isArray(scanners)) return false;
    return scanners.some((scanner) => (
        Boolean(scanner?.active) &&
        typeof scanner?.strategyId === 'string' &&
        scanner.strategyId.trim().length > 0 &&
        Array.isArray(scanner.symbols) &&
        scanner.symbols.length > 0 &&
        Array.isArray(scanner.timeframes) &&
        scanner.timeframes.length > 0
    ));
}

export function mergePersistedStrategyState(
    prev: StrategyState,
    migrated: Partial<PersistedStrategyState>,
): StrategyState {
    const next = {
        ...prev,
        ...migrated,
    } as StrategyState;

    const remoteHasUsableScanner = hasUsableMatrixScanner(migrated.matrixScanners);
    const localHasUsableScanner = hasUsableMatrixScanner(prev.matrixScanners);

    if (!remoteHasUsableScanner && localHasUsableScanner) {
        next.matrixScanners = prev.matrixScanners;
        next.focusedMatrixScannerId = prev.focusedMatrixScannerId;
        next.scopedLastSignalTimes = prev.scopedLastSignalTimes;
        next.signals = prev.signals.length >= (Array.isArray(migrated.signals) ? migrated.signals.length : 0)
            ? prev.signals
            : next.signals;
        next.virtualPositions =
            prev.virtualPositions.length >= (Array.isArray(migrated.virtualPositions) ? migrated.virtualPositions.length : 0)
                ? prev.virtualPositions
                : next.virtualPositions;
    }

    if (Array.isArray(prev.strategies) && prev.strategies.length > 0) {
        const remoteStrategies = Array.isArray(migrated.strategies) ? migrated.strategies : [];
        if (remoteStrategies.length < prev.strategies.length) {
            next.strategies = prev.strategies;
        }
    }

    return next;
}
