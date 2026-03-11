import type { StateCreator } from 'zustand';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { chartWorkerClient } from '@/workers/worker-client';
import { compareTimeframe, normalizeDashboardSymbol, normalizeDashboardTf } from '../dashboard/matrix-utils';
import type { StrategyDirection, TradeContext, VirtualPosition } from '../types';
import { buildMatrixScopeKey } from '../utils/matrix-scope';
import { normalizeTF } from '../utils/time-utils';
import { createDefaultScanner, DEFAULT_SCANNER_BASE, initialStrategies } from './strategy-store.defaults';
import type { StrategyState } from './strategy-store.types';

export const createStrategyStoreState: StateCreator<StrategyState, [], [], StrategyState> = (set, get) => ({
    strategies: initialStrategies,
    signals: [],
    virtualPositions: [],
    virtualBalance: 10000,
    initialVirtualBalance: 10000,
    lastBacktestPnL: 0,
    backtestCount: 0,
    matrixScanners: [createDefaultScanner(0)],
    focusedMatrixScannerId: null,
    scopedLastSignalTimes: {},
    addStrategy: (strategy) => {
        console.log('[Store] Adding strategy:', strategy.name);
        set((state) => ({ strategies: [...state.strategies, strategy] }));
    },
    updateStrategy: (id, updates) => {
        console.log('[Store] Updating strategy:', id, updates);
        set((state) => ({ strategies: state.strategies.map((s) => (s.id === id ? { ...s, ...updates } : s)) }));
    },
    deleteStrategy: (id) =>
        set((state) => ({
            strategies: state.strategies.filter((s) => s.id !== id),
            matrixScanners: state.matrixScanners.map((scanner) =>
                scanner.strategyId === id ? { ...scanner, strategyId: null, active: false } : scanner
            ),
        })),
    toggleStrategy: (id) =>
        set((state) => ({ strategies: state.strategies.map((s) => (s.id === id ? { ...s, active: !s.active } : s)) })),
    toggleAiGuard: (id) =>
        set((state) => ({ strategies: state.strategies.map((s) => (s.id === id ? { ...s, aiGuard: !s.aiGuard } : s)) })),
    addSignal: (signal) => set((state) => ({ signals: [signal, ...state.signals.slice(0, 49)] })),
    updateSignal: (index, signal) =>
        set((state) => {
            const newSignals = [...state.signals];
            newSignals[index] = signal;
            return { signals: newSignals };
        }),
    updateLastSignalTime: (strategyId, timestamp, matrixScopeKey) =>
        set((state) => ({
            strategies: state.strategies.map((s) => {
                if (s.id !== strategyId) return s;
                if (matrixScopeKey && s.lastSignalTime && s.symbol && s.timeframe) {
                    const defaultScope = buildMatrixScopeKey(s.id, s.symbol, s.timeframe);
                    if (defaultScope !== matrixScopeKey) return s;
                }
                return { ...s, lastSignalTime: timestamp };
            }),
            scopedLastSignalTimes: matrixScopeKey 
                ? { ...state.scopedLastSignalTimes, [matrixScopeKey]: timestamp }
                : state.scopedLastSignalTimes
        })),
    addVirtualPosition: (pos) => set((state) => ({ virtualPositions: [...state.virtualPositions, pos] })),
    cancelVirtualPosition: (strategyId: string, symbol: string, direction?: StrategyDirection, matrixScopeKey?: string) =>
        set((state) => ({
            virtualPositions: state.virtualPositions.filter(
                (p) =>
                    !(
                        p.strategyId === strategyId &&
                        p.symbol === symbol &&
                        p.status === 'pending' &&
                        (!direction || p.type === direction) &&
                        (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey)
                    )
            ),
        })),
    closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Partial<TradeContext>, direction?: StrategyDirection, matrixScopeKey?: string) =>
        set((state) => {
            let tradePnL = 0;
            const newPositions = state.virtualPositions.map((p) => {
                if (
                    p.strategyId === strategyId &&
                    p.symbol === symbol &&
                    (!direction || p.type === direction) &&
                    (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey) &&
                    (p.status === 'open' || p.status === 'pending')
                ) {
                    const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
                    const isJpy = symbol.toUpperCase().includes('JPY');
                    const multiplier = isGold ? 100 : isJpy ? 1000 : 100000;
                    tradePnL = (exitPrice - p.entryPrice) * (p.type === 'BUY' ? 1 : -1) * p.lotSize * multiplier;
                    const metadata = (p.metadata && metadataUpdate ? { ...p.metadata, ...metadataUpdate } : p.metadata || metadataUpdate) as TradeContext | undefined;

                    return {
                        ...p,
                        status: 'closed' as const,
                        exitPrice,
                        exitTimestamp: Date.now(),
                        pnl: tradePnL,
                        metadata,
                    };
                }
                return p;
            });

            return {
                virtualPositions: newPositions,
                virtualBalance: state.virtualBalance + tradePnL,
            };
        }),
    updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) =>
        set((state) => ({ virtualPositions: state.virtualPositions.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
    showHistoryMarkers: true,
    toggleShowHistoryMarkers: () => set((state) => ({ showHistoryMarkers: !state.showHistoryMarkers })),
    clearSignals: () => set({ signals: [] }),
    clearVirtualPositions: () => set({ virtualPositions: [] }),
    setVirtualBalance: (balance: number) => set(() => ({ virtualBalance: balance, initialVirtualBalance: balance })),
    resetVirtualBalance: () => set((state) => ({ virtualBalance: state.initialVirtualBalance })),
    resetVirtualAccount: () =>
        set((state) => ({
            virtualPositions: [],
            signals: [],
            virtualBalance: state.initialVirtualBalance,
            lastBacktestPnL: 0,
            backtestCount: 0,
            lastResetTime: Date.now(),
            scopedLastSignalTimes: {},
        })),
    lastResetTime: 0,
    runBacktest: async (strategyId, candles, overrideSymbol, overrideTimeframe, source = 'MT5', matrixScopeKey) => {
        const strategy = get().strategies.find((s) => s.id === strategyId);
        if (!strategy) return;

        try {
            const backtestPositions = await chartWorkerClient.runBacktest(
                strategy,
                candles,
                get().initialVirtualBalance,
                overrideSymbol,
                overrideTimeframe,
                source,
                matrixScopeKey
            );

            set((state) => {
                const livePositions = state.virtualPositions.filter((p) => !p.isHistorical);
                const tradeSymbol = normalizeSymbol(overrideSymbol || strategy.symbol || '');
                const tradeTimeframe = normalizeTF(overrideTimeframe || strategy.timeframe || '');
                const scopeKey = matrixScopeKey || (tradeSymbol && tradeTimeframe ? buildMatrixScopeKey(strategy.id, tradeSymbol, tradeTimeframe) : undefined);
                const otherHistorical = state.virtualPositions.filter(
                    (p) =>
                        p.isHistorical &&
                        (scopeKey
                            ? p.matrixScopeKey !== scopeKey
                            : p.strategyId !== strategyId || normalizeSymbol(p.symbol) !== tradeSymbol || normalizeTF(p.timeframe) !== tradeTimeframe)
                );
                const scopedBacktestPositions = (backtestPositions as VirtualPosition[]).map((p) => ({
                    ...p,
                    symbol: normalizeSymbol(p.symbol),
                    timeframe: normalizeTF(p.timeframe || tradeTimeframe),
                    source: p.source || source,
                    matrixScopeKey: p.matrixScopeKey || scopeKey,
                }));
                const mergedPositions = [...livePositions, ...otherHistorical, ...scopedBacktestPositions];
                const backtestPnL = backtestPositions.reduce((sum: number, p: VirtualPosition) => sum + (p.pnl || 0), 0);

                return {
                    virtualPositions: mergedPositions,
                    lastBacktestPnL: backtestPnL,
                    backtestCount: backtestPositions.length,
                };
            });
        } catch (err) {
            console.error('[Store] Backtest Worker Failed:', err);
        }
    },
    addMatrixScanner: () => set((state) => ({ matrixScanners: [...state.matrixScanners, createDefaultScanner(state.matrixScanners.length)] })),
    addMatrixScannerForStrategy: (strategyId: string) => {
        const scannerId = `scanner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
            matrixScanners: [
                ...state.matrixScanners,
                {
                    id: scannerId,
                    name: `Matrix ${state.matrixScanners.length + 1}`,
                    strategyId,
                    active: false,
                    symbols: [...DEFAULT_SCANNER_BASE.symbols],
                    timeframes: [...DEFAULT_SCANNER_BASE.timeframes],
                    symbolSortMode: DEFAULT_SCANNER_BASE.symbolSortMode,
                    signalTtlMultiplier: DEFAULT_SCANNER_BASE.signalTtlMultiplier,
                    signalTtlFloorSec: DEFAULT_SCANNER_BASE.signalTtlFloorSec,
                },
            ],
            focusedMatrixScannerId: scannerId,
        }));
        return scannerId;
    },
    findMatrixScannerByStrategy: (strategyId: string) => get().matrixScanners.find((s) => s.strategyId === strategyId)?.id || null,
    focusMatrixScanner: (scannerId: string | null) => set({ focusedMatrixScannerId: scannerId }),
    removeMatrixScanner: (scannerId: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.filter((s) => s.id !== scannerId),
            focusedMatrixScannerId: state.focusedMatrixScannerId === scannerId ? null : state.focusedMatrixScannerId,
        })),
    setMatrixScannerName: (scannerId: string, name: string) =>
        set((state) => ({ matrixScanners: state.matrixScanners.map((s) => (s.id === scannerId ? { ...s, name: name.trim() || s.name } : s)) })),
    setMatrixScannerStrategy: (scannerId: string, strategyId: string | null) =>
        set((state) => ({ matrixScanners: state.matrixScanners.map((s) => (s.id === scannerId ? { ...s, strategyId, active: strategyId ? s.active : false } : s)) })),
    toggleMatrixScanner: (scannerId: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) => {
                if (s.id !== scannerId) return s;
                if (!s.strategyId) return { ...s, active: false };
                return { ...s, active: !s.active };
            }),
        })),
    addMatrixScannerSymbol: (scannerId: string, symbol: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) => {
                if (s.id !== scannerId) return s;
                const normalized = normalizeDashboardSymbol(symbol);
                if (!normalized) return s;
                if (s.symbols.some((it) => it.toLowerCase() === normalized.toLowerCase())) return s;
                return { ...s, symbols: [...s.symbols, normalized] };
            }),
        })),
    removeMatrixScannerSymbol: (scannerId: string, symbol: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) => {
                if (s.id !== scannerId) return s;
                const normalized = normalizeDashboardSymbol(symbol);
                if (!normalized) return s;
                return { ...s, symbols: s.symbols.filter((it) => it.toLowerCase() !== normalized.toLowerCase()) };
            }),
        })),
    addMatrixScannerTimeframe: (scannerId: string, timeframe: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) => {
                if (s.id !== scannerId) return s;
                const normalized = normalizeDashboardTf(timeframe);
                if (!normalized) return s;
                if (s.timeframes.includes(normalized)) return s;
                return { ...s, timeframes: [...s.timeframes, normalized].sort(compareTimeframe) };
            }),
        })),
    removeMatrixScannerTimeframe: (scannerId: string, timeframe: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) => {
                if (s.id !== scannerId) return s;
                const normalized = normalizeDashboardTf(timeframe);
                if (!normalized) return s;
                return { ...s, timeframes: s.timeframes.filter((tf) => tf !== normalized) };
            }),
        })),
    setMatrixScannerSymbolSortMode: (scannerId: string, mode) =>
        set((state) => ({ matrixScanners: state.matrixScanners.map((s) => (s.id === scannerId ? { ...s, symbolSortMode: mode } : s)) })),
    setMatrixScannerSignalTtlMultiplier: (scannerId: string, multiplier: number) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) =>
                s.id === scannerId ? { ...s, signalTtlMultiplier: Math.max(1, Number.isFinite(multiplier) ? Math.floor(multiplier) : 2) } : s
            ),
        })),
    setMatrixScannerSignalTtlFloorSec: (scannerId: string, seconds: number) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) =>
                s.id === scannerId ? { ...s, signalTtlFloorSec: Math.max(1, Number.isFinite(seconds) ? Math.floor(seconds) : 60) } : s
            ),
        })),
    resetMatrixScannerConfig: (scannerId: string) =>
        set((state) => ({
            matrixScanners: state.matrixScanners.map((s) =>
                s.id === scannerId
                    ? {
                          ...s,
                          symbols: [...DEFAULT_SCANNER_BASE.symbols],
                          timeframes: [...DEFAULT_SCANNER_BASE.timeframes],
                          symbolSortMode: DEFAULT_SCANNER_BASE.symbolSortMode,
                          signalTtlMultiplier: DEFAULT_SCANNER_BASE.signalTtlMultiplier,
                          signalTtlFloorSec: DEFAULT_SCANNER_BASE.signalTtlFloorSec,
                      }
                    : s
            ),
        })),
});
