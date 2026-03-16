import { normalizeSymbol } from '@/lib/utils/symbol';
import { useMemo } from 'react';
import { buildMatrixCellState } from '@/features/strategy/dashboard/matrix-cell-state';
import { compareTimeframe, inferMatrixSymbolSource, normalizeDashboardSymbol, sortSymbols, timeframeToChartInterval } from '@/features/strategy/dashboard/matrix-utils';
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

        // Optimization: Create a lookup for signals by symbol to avoid O(N) filtering per cell
        const signalsBySymbol = new Map<string, StrategySignal[]>();
        for (const sig of input.signals) {
            const sym = normalizeSymbol(sig.symbol).toLowerCase();
            if (!signalsBySymbol.has(sym)) signalsBySymbol.set(sym, []);
            signalsBySymbol.get(sym)!.push(sig);
        }

        // Optimization: Create a lookup for positions by symbol
        const positionsBySymbol = new Map<string, VirtualPosition[]>();
        for (const pos of input.virtualPositions) {
            const sym = normalizeSymbol(pos.symbol).toLowerCase();
            if (!positionsBySymbol.has(sym)) positionsBySymbol.set(sym, []);
            positionsBySymbol.get(sym)!.push(pos);
        }

        for (const scanner of input.matrixScanners) {
            const sortedSymbols = sortSymbols(scanner.symbols, scanner.symbolSortMode);
            const sortedTimeframes = [...scanner.timeframes].sort(compareTimeframe);
            const cells = new Map<string, MatrixCellState>();

            for (const symbol of sortedSymbols) {
                const normSymbol = normalizeSymbol(symbol).toLowerCase();
                const symbolSignals = signalsBySymbol.get(normSymbol) || [];
                const symbolPositions = positionsBySymbol.get(normSymbol) || [];

                for (const timeframe of sortedTimeframes) {
                    const cell = buildMatrixCellState({
                        symbol,
                        timeframe,
                        strategyId: scanner.strategyId,
                        strategies: input.strategies,
                        signals: symbolSignals, // Pre-filtered
                        virtualPositions: symbolPositions, // Pre-filtered
                        matrixConfig: scanner,
                        getCandles: (s, tf) => {
                            const interval = timeframeToChartInterval(tf);
                            const source = inferMatrixSymbolSource(s);
                            const key = `${source}:${s}:${interval}`;
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
