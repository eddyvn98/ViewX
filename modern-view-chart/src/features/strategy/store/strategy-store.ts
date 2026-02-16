
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Strategy, StrategySignal, VirtualPosition, TradeContext } from '../types';
import { BacktestRunner } from '../logic/BacktestRunner';
import { chartWorkerClient } from '@/workers/worker-client';

interface StrategyState {
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
    virtualBalance: number;
    initialVirtualBalance: number;
    lastBacktestPnL: number;
    backtestCount: number;
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
    lastResetTime: number; // For synchronization
    runBacktest: (strategyId: string, candles: any[], overrideSymbol?: string) => Promise<void>;
}


export const useStrategyStore = create<StrategyState>()(
    persist(
        (set, get) => ({
            strategies: [
                {
                    id: 'hull-ha-gold-buy',
                    name: 'Hull HA Gold Scalper (BUY)',
                    side: 'BUY',
                    symbol: 'XAUUSDm',

                    timeframe: '1m',
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
                                right: 60
                            }
                        ]
                    },
                    exit: {
                        operator: 'OR',
                        conditions: [
                            {
                                id: 'buy-rsi-exit',
                                left: { type: 'RSI', params: [14] },
                                comparator: '<',
                                right: 55
                            }
                        ]
                    },
                    risk: {
                        sl: { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 },
                        tp: undefined,
                        trailing: true,
                        slSource: 'HA_Low',
                        trailingSource: 'HA_Low',
                        lotSize: 0.1
                    },
                    cancelConditions: {
                        operator: 'OR',
                        conditions: [
                            {
                                id: 'buy-cancel-rsi',
                                left: { type: 'RSI', params: [14] },
                                comparator: '<',
                                right: 55
                            }
                        ]
                    }
                },
                {
                    id: 'hull-ha-gold-sell',
                    name: 'Hull HA Gold Scalper (SELL)',
                    side: 'SELL',
                    symbol: 'XAUUSDm',

                    timeframe: '1m',
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
                                right: 40
                            }
                        ]
                    },
                    exit: {
                        operator: 'OR',
                        conditions: [
                            {
                                id: 'sell-rsi-exit',
                                left: { type: 'RSI', params: [14] },
                                comparator: '>',
                                right: 45
                            }
                        ]
                    },
                    risk: {
                        sl: { mode: 'candle', candleField: 'high', candleOffset: 1, offset: 0 },
                        tp: undefined,
                        trailing: true,
                        slSource: 'HA_High',
                        trailingSource: 'HA_High',
                        lotSize: 0.1
                    },
                    cancelConditions: {
                        operator: 'OR',
                        conditions: [
                            {
                                id: 'sell-cancel-rsi',
                                left: { type: 'RSI', params: [14] },
                                comparator: '>',
                                right: 45
                            }
                        ]
                    }
                },

                {
                    id: 'test-trigger-rsi',
                    name: 'Test Fast Trigger (RSI > 20)',
                    side: 'BUY',
                    symbol: '', // Dynamic Symbol (Uses active chart)

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
                                right: 20
                            }
                        ]
                    },
                    risk: {
                        sl: 100,
                        tp: 200,
                        trailing: false,
                        lotSize: 0.01,
                        cooldownMinutes: 1
                    }
                }
            ],
            signals: [],
            virtualPositions: [],
            virtualBalance: 10000,
            initialVirtualBalance: 10000,
            lastBacktestPnL: 0,
            backtestCount: 0,
            addStrategy: (strategy) => {
                console.log('[Store] Adding strategy:', strategy.name);
                set((state) => ({ strategies: [...state.strategies, strategy] }));
            },
            updateStrategy: (id, updates) => {
                console.log('[Store] Updating strategy:', id, updates);
                set((state) => ({
                    strategies: state.strategies.map(s => s.id === id ? { ...s, ...updates } : s)
                }));
            },
            deleteStrategy: (id) => set((state) => ({
                strategies: state.strategies.filter(s => s.id !== id)
            })),
            toggleStrategy: (id) => set((state) => ({
                strategies: state.strategies.map(s => s.id === id ? { ...s, active: !s.active } : s)
            })),
            toggleAiGuard: (id) => set((state) => ({
                strategies: state.strategies.map(s => s.id === id ? { ...s, aiGuard: !s.aiGuard } : s)
            })),
            addSignal: (signal) => set((state) => ({
                signals: [signal, ...state.signals.slice(0, 49)]
            })),
            updateSignal: (index, signal) => set((state) => {
                const newSignals = [...state.signals];
                newSignals[index] = signal;
                return { signals: newSignals };
            }),
            updateLastSignalTime: (strategyId, timestamp) => set((state) => ({
                strategies: state.strategies.map(s => s.id === strategyId ? { ...s, lastSignalTime: timestamp } : s)
            })),
            addVirtualPosition: (pos) => set((state) => ({
                virtualPositions: [...state.virtualPositions, pos]
            })),
            cancelVirtualPosition: (strategyId: string, symbol: string) => set((state) => ({
                virtualPositions: state.virtualPositions.filter(p => !(p.strategyId === strategyId && p.symbol === symbol && p.status === 'pending'))
            })),
            closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Partial<TradeContext>) => set((state) => {
                let tradePnL = 0;
                const newPositions = state.virtualPositions.map(p => {
                    if (p.strategyId === strategyId && p.symbol === symbol && (p.status === 'open' || p.status === 'pending')) {
                        // Approximation for PnL in USD
                        const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
                        const isJpy = symbol.toUpperCase().includes('JPY');
                        const multiplier = isGold ? 100 : (isJpy ? 1000 : 100000);
                        tradePnL = (exitPrice - p.entryPrice) * (p.type === 'BUY' ? 1 : -1) * p.lotSize * multiplier;

                        return {
                            ...p,
                            status: 'closed' as const,
                            exitPrice,
                            exitTimestamp: Date.now(),
                            pnl: tradePnL,
                            metadata: p.metadata && metadataUpdate ? { ...p.metadata, ...metadataUpdate } : (p.metadata || metadataUpdate as any)
                        };
                    }
                    return p;
                });

                return {
                    virtualPositions: newPositions,
                    virtualBalance: state.virtualBalance + tradePnL
                };
            }),
            updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => set((state) => ({
                virtualPositions: state.virtualPositions.map(p => p.id === id ? { ...p, ...updates } : p)
            })),
            showHistoryMarkers: true,
            toggleShowHistoryMarkers: () => set((state) => ({ showHistoryMarkers: !state.showHistoryMarkers })),
            clearSignals: () => set({ signals: [] }),
            clearVirtualPositions: () => set({ virtualPositions: [] }),
            setVirtualBalance: (balance: number) => set((state) => ({
                virtualBalance: balance,
                initialVirtualBalance: balance // Update initial whenever they manually set balance
            })),
            resetVirtualBalance: () => set((state) => ({
                virtualBalance: state.initialVirtualBalance
            })),
            resetVirtualAccount: () => set((state) => ({
                virtualPositions: [],
                signals: [],
                virtualBalance: state.initialVirtualBalance,
                lastBacktestPnL: 0,
                backtestCount: 0,
                lastResetTime: Date.now()
            })),
            lastResetTime: 0,
            runBacktest: async (strategyId, candles, overrideSymbol) => {
                const strategy = get().strategies.find(s => s.id === strategyId);
                if (!strategy) return;

                console.log(`[Store] Starting Worker Backtest for ${strategy.name} (${candles.length} candles)...`);

                try {
                    const backtestPositions = await chartWorkerClient.runBacktest(
                        strategy,
                        candles,
                        get().initialVirtualBalance,
                        overrideSymbol
                    );

                    set((state) => {
                        // 1. Keep Live Positions
                        const livePositions = state.virtualPositions.filter(p => !p.isHistorical);

                        // 2. Clear old historical positions for THIS strategy and symbol
                        const tradeSymbol = overrideSymbol || strategy.symbol || '';
                        const otherHistorical = state.virtualPositions.filter(p =>
                            p.isHistorical && (p.strategyId !== strategyId || p.symbol !== tradeSymbol)
                        );

                        // 3. Merge: Live + Historical from other strats + New Backtest results
                        const mergedPositions = [...livePositions, ...otherHistorical, ...backtestPositions];

                        // 4. Calculate Backtest Summary
                        const backtestPnL = backtestPositions.reduce((sum: number, p: VirtualPosition) => sum + (p.pnl || 0), 0);

                        console.log(`[Store] Backtest Complete. Total Positions: ${mergedPositions.length} (New: ${backtestPositions.length}) | PnL: ${backtestPnL}`);

                        return {
                            virtualPositions: mergedPositions,
                            lastBacktestPnL: backtestPnL,
                            backtestCount: backtestPositions.length
                        };
                    });
                } catch (err) {
                    console.error('[Store] Backtest Worker Failed:', err);
                }
            },
        }),

        {
            name: 'strategy-storage',
        }
    )
);
