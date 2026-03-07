import { useMemo } from 'react';
import { buildMatrixCellState } from '@/features/strategy/dashboard/matrix-cell-state';
import { compareTimeframe, normalizeDashboardSymbol, sortSymbols, timeframeToChartInterval } from '@/features/strategy/dashboard/matrix-utils';
import type { MatrixScannerConfig, MatrixCellState } from '@/features/strategy/dashboard/matrix-types';
import type { Strategy, StrategySignal, VirtualPosition } from '@/features/strategy/types';
import type { Candle } from '@/lib/store/types';

export interface ScannerViewModel {
    symbols: string[];
    timeframes: string[];
    cells: Map<string, MatrixCellState>;
}

interface UseScannerViewModelInput {
    matrixScanners: MatrixScannerConfig[];
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
    candleData: Record<string, Candle[]>;
    watchlist: string[];
}

export function useScannerViewModel(input: UseScannerViewModelInput) {
    const symbolCandidates = useMemo(() => {
        return Array.from(new Set(input.watchlist.map((s) => normalizeDashboardSymbol(s)).filter(Boolean)));
    }, [input.watchlist]);

    const scannerViewMap = useMemo(() => {
        const map = new Map<string, ScannerViewModel>();
        const now = Date.now();

        for (const scanner of input.matrixScanners) {
            const sortedSymbols = sortSymbols(scanner.symbols, scanner.symbolSortMode);
            const sortedTimeframes = [...scanner.timeframes].sort(compareTimeframe);
            const cells = new Map<string, MatrixCellState>();

            for (const symbol of sortedSymbols) {
                for (const timeframe of sortedTimeframes) {
                    const cell = buildMatrixCellState({
                        symbol,
                        timeframe,
                        strategyId: scanner.strategyId,
                        strategies: input.strategies,
                        signals: input.signals,
                        virtualPositions: input.virtualPositions,
                        matrixConfig: scanner,
                        getCandles: (s, tf) => {
                            const interval = timeframeToChartInterval(tf);
                            const key = `MT5:${s}:${interval}`;
                            return input.candleData[key] || [];
                        },
                        nowMs: now,
                    });
                    cells.set(`${symbol}__${timeframe}`, cell);
                }
            }

            map.set(scanner.id, { symbols: sortedSymbols, timeframes: sortedTimeframes, cells });
        }

        return map;
    }, [input.matrixScanners, input.strategies, input.signals, input.virtualPositions, input.candleData]);

    return {
        symbolCandidates,
        scannerViewMap,
    };
}
