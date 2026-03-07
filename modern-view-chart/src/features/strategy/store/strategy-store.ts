import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Strategy, StrategySignal, TradeContext, VirtualPosition } from '../types';
import type { Candle } from '@/lib/store/types';
import { chartWorkerClient } from '@/workers/worker-client';
import type { MatrixScannerConfig, MatrixSortMode, StrategyMatrixConfig } from '../dashboard/matrix-types';
import { compareTimeframe, normalizeDashboardSymbol, normalizeDashboardTf } from '../dashboard/matrix-utils';

const DEFAULT_SCANNER_BASE = {
    symbols: ['XAUUSDm', 'BTCUSDm', 'EURUSDm'],
    timeframes: ['1m', '5m', '15m', '1h', '4h'],
    symbolSortMode: 'added' as MatrixSortMode,
    signalTtlMultiplier: 2,
    signalTtlFloorSec: 60,
};

const LEGACY_DEFAULT_MATRIX_CONFIG: StrategyMatrixConfig = { ...DEFAULT_SCANNER_BASE };

function createScannerFromConfig(config: StrategyMatrixConfig, strategyId: string | null = null): MatrixScannerConfig {
    return {
        id: `scanner-${Date.now()}`,
        name: 'Matrix Scanner 1',
        strategyId,
        active: false,
        symbols: [...config.symbols],
        timeframes: [...config.timeframes],
        symbolSortMode: config.symbolSortMode,
        signalTtlMultiplier: config.signalTtlMultiplier,
        signalTtlFloorSec: config.signalTtlFloorSec,
    };
}

function createDefaultScanner(index = 0): MatrixScannerConfig {
    return {
        id: `scanner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Matrix Scanner ${index + 1}`,
        strategyId: null,
        active: false,
        symbols: [...DEFAULT_SCANNER_BASE.symbols],
        timeframes: [...DEFAULT_SCANNER_BASE.timeframes],
        symbolSortMode: DEFAULT_SCANNER_BASE.symbolSortMode,
        signalTtlMultiplier: DEFAULT_SCANNER_BASE.signalTtlMultiplier,
        signalTtlFloorSec: DEFAULT_SCANNER_BASE.signalTtlFloorSec,
    };
}

export function migrateStrategyStoreState(persistedState: unknown, version: number) {
    const state = (persistedState || {}) as Record<string, unknown>;
    if (version < 2) {
        const legacyRaw = state.matrixConfig as StrategyMatrixConfig | undefined;
        const legacyConfig: StrategyMatrixConfig =
            legacyRaw && Array.isArray(legacyRaw.symbols) && Array.isArray(legacyRaw.timeframes)
                ? legacyRaw
                : LEGACY_DEFAULT_MATRIX_CONFIG;
        const scanners = Array.isArray(state.matrixScanners) && state.matrixScanners.length > 0
            ? state.matrixScanners
            : [createScannerFromConfig(legacyConfig, null)];
        return {
            ...state,
            matrixScanners: scanners,
            focusedMatrixScannerId: null,
        };
    }
    if (!Array.isArray(state.matrixScanners) || state.matrixScanners.length === 0) {
        return {
            ...state,
            matrixScanners: [createDefaultScanner(0)],
            focusedMatrixScannerId: null,
        };
    }
    return {
        ...state,
        focusedMatrixScannerId: typeof state.focusedMatrixScannerId === 'string' ? state.focusedMatrixScannerId : null,
    };
}

interface StrategyState {
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
    virtualBalance: number;
    initialVirtualBalance: number;
    lastBacktestPnL: number;
    backtestCount: number;
    matrixScanners: MatrixScannerConfig[];
    focusedMatrixScannerId: string | null;
    addStrategy: (strategy: Strategy) => void;
    updateStrategy: (id: string, updates: Partial<Strategy>) => void;
    deleteStrategy: (id: string) => void;
    toggleStrategy: (id: string) => void;
    toggleAiGuard: (id: string) => void;
    addSignal: (signal: StrategySignal) => void;
    updateSignal: (index: number, signal: StrategySignal) => void;
    updateLastSignalTime: (strategyId: string, timestamp: number) => void;
    addVirtualPosition: (pos: VirtualPosition) => void;
    cancelVirtualPosition: (strategyId: string, symbol: string) => void;
    closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Partial<TradeContext>) => void;
    updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => void;
    showHistoryMarkers: boolean;
    toggleShowHistoryMarkers: () => void;
    clearSignals: () => void;
    clearVirtualPositions: () => void;
    setVirtualBalance: (balance: number) => void;
    resetVirtualBalance: () => void;
    resetVirtualAccount: () => void;
    lastResetTime: number;
    runBacktest: (strategyId: string, candles: Candle[], overrideSymbol?: string) => Promise<void>;
    addMatrixScanner: () => void;
    addMatrixScannerForStrategy: (strategyId: string) => string;
    findMatrixScannerByStrategy: (strategyId: string) => string | null;
    focusMatrixScanner: (scannerId: string | null) => void;
    removeMatrixScanner: (scannerId: string) => void;
    setMatrixScannerName: (scannerId: string, name: string) => void;
    setMatrixScannerStrategy: (scannerId: string, strategyId: string | null) => void;
    toggleMatrixScanner: (scannerId: string) => void;
    addMatrixScannerSymbol: (scannerId: string, symbol: string) => void;
    removeMatrixScannerSymbol: (scannerId: string, symbol: string) => void;
    addMatrixScannerTimeframe: (scannerId: string, timeframe: string) => void;
    removeMatrixScannerTimeframe: (scannerId: string, timeframe: string) => void;
    setMatrixScannerSymbolSortMode: (scannerId: string, mode: MatrixSortMode) => void;
    setMatrixScannerSignalTtlMultiplier: (scannerId: string, multiplier: number) => void;
    setMatrixScannerSignalTtlFloorSec: (scannerId: string, seconds: number) => void;
    resetMatrixScannerConfig: (scannerId: string) => void;
}

const initialStrategies: Strategy[] = [
    {
        id: 'hull-ha-gold-buy',
        name: 'Hull HA Gold Scalper (BUY)',
        side: 'BUY',
        active: true,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'stop',
        magic: 123456,
        comment: 'WebHA_Buy',
        entry: {
            operator: 'AND',
            conditions: [
                {
                    id: 'buy-rsi-60',
                    left: { type: 'RSI', params: [14] },
                    comparator: '>',
                    right: 60,
                },
            ],
        },
        exit: {
            operator: 'OR',
            conditions: [
                {
                    id: 'buy-rsi-exit',
                    left: { type: 'RSI', params: [14] },
                    comparator: '<',
                    right: 55,
                },
            ],
        },
        risk: {
            sl: { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 },
            tp: undefined,
            trailing: true,
            slSource: 'HA_Low',
            trailingSource: 'HA_Low',
            lotSize: 0.1,
        },
        cancelConditions: {
            operator: 'OR',
            conditions: [
                {
                    id: 'buy-cancel-rsi',
                    left: { type: 'RSI', params: [14] },
                    comparator: '<',
                    right: 55,
                },
            ],
        },
    },
    {
        id: 'hull-ha-gold-sell',
        name: 'Hull HA Gold Scalper (SELL)',
        side: 'SELL',
        active: true,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'stop',
        magic: 123456,
        comment: 'WebHA_Sell',
        entry: {
            operator: 'AND',
            conditions: [
                {
                    id: 'sell-rsi-40',
                    left: { type: 'RSI', params: [14] },
                    comparator: '<',
                    right: 40,
                },
            ],
        },
        exit: {
            operator: 'OR',
            conditions: [
                {
                    id: 'sell-rsi-exit',
                    left: { type: 'RSI', params: [14] },
                    comparator: '>',
                    right: 45,
                },
            ],
        },
        risk: {
            sl: { mode: 'candle', candleField: 'high', candleOffset: 1, offset: 0 },
            tp: undefined,
            trailing: true,
            slSource: 'HA_High',
            trailingSource: 'HA_High',
            lotSize: 0.1,
        },
        cancelConditions: {
            operator: 'OR',
            conditions: [
                {
                    id: 'sell-cancel-rsi',
                    left: { type: 'RSI', params: [14] },
                    comparator: '>',
                    right: 45,
                },
            ],
        },
    },
    {
        id: 'test-trigger-rsi',
        name: 'Test Fast Trigger (RSI > 20)',
        side: 'BUY',
        active: false,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        magic: 999999,
        comment: 'TestTrigger',
        entry: {
            operator: 'AND',
            conditions: [
                {
                    id: 'rsi-gt-20',
                    left: { type: 'RSI', params: [14] },
                    comparator: '>',
                    right: 20,
                },
            ],
        },
        risk: {
            sl: 100,
            tp: 200,
            trailing: false,
            lotSize: 0.01,
            cooldownMinutes: 1,
        },
    },
];

export const useStrategyStore = create<StrategyState>()(
    persist(
        (set, get) => ({
            strategies: initialStrategies,
            signals: [],
            virtualPositions: [],
            virtualBalance: 10000,
            initialVirtualBalance: 10000,
            lastBacktestPnL: 0,
            backtestCount: 0,
            matrixScanners: [createDefaultScanner(0)],
            focusedMatrixScannerId: null,
            addStrategy: (strategy) => {
                console.log('[Store] Adding strategy:', strategy.name);
                set((state) => ({ strategies: [...state.strategies, strategy] }));
            },
            updateStrategy: (id, updates) => {
                console.log('[Store] Updating strategy:', id, updates);
                set((state) => ({
                    strategies: state.strategies.map((s) => (s.id === id ? { ...s, ...updates } : s)),
                }));
            },
            deleteStrategy: (id) =>
                set((state) => ({
                    strategies: state.strategies.filter((s) => s.id !== id),
                    matrixScanners: state.matrixScanners.map((scanner) =>
                        scanner.strategyId === id ? { ...scanner, strategyId: null, active: false } : scanner
                    ),
                })),
            toggleStrategy: (id) =>
                set((state) => ({
                    strategies: state.strategies.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
                })),
            toggleAiGuard: (id) =>
                set((state) => ({
                    strategies: state.strategies.map((s) => (s.id === id ? { ...s, aiGuard: !s.aiGuard } : s)),
                })),
            addSignal: (signal) =>
                set((state) => ({
                    signals: [signal, ...state.signals.slice(0, 49)],
                })),
            updateSignal: (index, signal) =>
                set((state) => {
                    const newSignals = [...state.signals];
                    newSignals[index] = signal;
                    return { signals: newSignals };
                }),
            updateLastSignalTime: (strategyId, timestamp) =>
                set((state) => ({
                    strategies: state.strategies.map((s) => (s.id === strategyId ? { ...s, lastSignalTime: timestamp } : s)),
                })),
            addVirtualPosition: (pos) =>
                set((state) => ({
                    virtualPositions: [...state.virtualPositions, pos],
                })),
            cancelVirtualPosition: (strategyId: string, symbol: string) =>
                set((state) => ({
                    virtualPositions: state.virtualPositions.filter(
                        (p) => !(p.strategyId === strategyId && p.symbol === symbol && p.status === 'pending')
                    ),
                })),
            closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Partial<TradeContext>) =>
                set((state) => {
                    let tradePnL = 0;
                    const newPositions = state.virtualPositions.map((p) => {
                        if (p.strategyId === strategyId && p.symbol === symbol && (p.status === 'open' || p.status === 'pending')) {
                            const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
                            const isJpy = symbol.toUpperCase().includes('JPY');
                            const multiplier = isGold ? 100 : isJpy ? 1000 : 100000;
                            tradePnL = (exitPrice - p.entryPrice) * (p.type === 'BUY' ? 1 : -1) * p.lotSize * multiplier;

                            const metadata = (p.metadata && metadataUpdate
                                ? { ...p.metadata, ...metadataUpdate }
                                : p.metadata || metadataUpdate) as TradeContext | undefined;

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
                set((state) => ({
                    virtualPositions: state.virtualPositions.map((p) => (p.id === id ? { ...p, ...updates } : p)),
                })),
            showHistoryMarkers: true,
            toggleShowHistoryMarkers: () => set((state) => ({ showHistoryMarkers: !state.showHistoryMarkers })),
            clearSignals: () => set({ signals: [] }),
            clearVirtualPositions: () => set({ virtualPositions: [] }),
            setVirtualBalance: (balance: number) =>
                set(() => ({
                    virtualBalance: balance,
                    initialVirtualBalance: balance,
                })),
            resetVirtualBalance: () =>
                set((state) => ({
                    virtualBalance: state.initialVirtualBalance,
                })),
            resetVirtualAccount: () =>
                set((state) => ({
                    virtualPositions: [],
                    signals: [],
                    virtualBalance: state.initialVirtualBalance,
                    lastBacktestPnL: 0,
                    backtestCount: 0,
                    lastResetTime: Date.now(),
                })),
            lastResetTime: 0,
            runBacktest: async (strategyId, candles, overrideSymbol) => {
                const strategy = get().strategies.find((s) => s.id === strategyId);
                if (!strategy) return;

                try {
                    const backtestPositions = await chartWorkerClient.runBacktest(
                        strategy,
                        candles,
                        get().initialVirtualBalance,
                        overrideSymbol
                    );

                    set((state) => {
                        const livePositions = state.virtualPositions.filter((p) => !p.isHistorical);
                        const tradeSymbol = overrideSymbol || strategy.symbol || '';
                        const otherHistorical = state.virtualPositions.filter(
                            (p) => p.isHistorical && (p.strategyId !== strategyId || p.symbol !== tradeSymbol)
                        );
                        const mergedPositions = [...livePositions, ...otherHistorical, ...backtestPositions];
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
            addMatrixScanner: () =>
                set((state) => ({
                    matrixScanners: [...state.matrixScanners, createDefaultScanner(state.matrixScanners.length)],
                })),
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
            findMatrixScannerByStrategy: (strategyId: string) => {
                const scanner = get().matrixScanners.find((s) => s.strategyId === strategyId);
                return scanner?.id || null;
            },
            focusMatrixScanner: (scannerId: string | null) => set({ focusedMatrixScannerId: scannerId }),
            removeMatrixScanner: (scannerId: string) =>
                set((state) => ({
                    matrixScanners: state.matrixScanners.filter((s) => s.id !== scannerId),
                    focusedMatrixScannerId: state.focusedMatrixScannerId === scannerId ? null : state.focusedMatrixScannerId,
                })),
            setMatrixScannerName: (scannerId: string, name: string) =>
                set((state) => ({
                    matrixScanners: state.matrixScanners.map((s) =>
                        s.id === scannerId ? { ...s, name: name.trim() || s.name } : s
                    ),
                })),
            setMatrixScannerStrategy: (scannerId: string, strategyId: string | null) =>
                set((state) => ({
                    matrixScanners: state.matrixScanners.map((s) =>
                        s.id === scannerId ? { ...s, strategyId, active: strategyId ? s.active : false } : s
                    ),
                })),
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
            setMatrixScannerSymbolSortMode: (scannerId: string, mode: MatrixSortMode) =>
                set((state) => ({
                    matrixScanners: state.matrixScanners.map((s) => (s.id === scannerId ? { ...s, symbolSortMode: mode } : s)),
                })),
            setMatrixScannerSignalTtlMultiplier: (scannerId: string, multiplier: number) =>
                set((state) => ({
                    matrixScanners: state.matrixScanners.map((s) =>
                        s.id === scannerId
                            ? { ...s, signalTtlMultiplier: Math.max(1, Number.isFinite(multiplier) ? Math.floor(multiplier) : 2) }
                            : s
                    ),
                })),
            setMatrixScannerSignalTtlFloorSec: (scannerId: string, seconds: number) =>
                set((state) => ({
                    matrixScanners: state.matrixScanners.map((s) =>
                        s.id === scannerId
                            ? { ...s, signalTtlFloorSec: Math.max(1, Number.isFinite(seconds) ? Math.floor(seconds) : 60) }
                            : s
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
        }),
        {
            name: 'strategy-storage',
            version: 2,
            migrate: migrateStrategyStoreState,
        }
    )
);
