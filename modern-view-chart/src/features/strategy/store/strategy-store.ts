
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Strategy, StrategySignal, VirtualPosition } from '../types';

interface StrategyState {
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
    virtualBalance: number;
    initialVirtualBalance: number;
    addStrategy: (strategy: Strategy) => void;
    updateStrategy: (id: string, updates: Partial<Strategy>) => void;
    deleteStrategy: (id: string) => void;
    toggleStrategy: (id: string) => void;
    addSignal: (signal: StrategySignal) => void;
    updateLastSignalTime: (strategyId: string, timestamp: number) => void;
    addVirtualPosition: (pos: VirtualPosition) => void;
    cancelVirtualPosition: (strategyId: string, symbol: string) => void;
    closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number) => void;
    updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => void;
    showHistoryMarkers: boolean;
    toggleShowHistoryMarkers: () => void;
    clearSignals: () => void;
    clearVirtualPositions: () => void;
    setVirtualBalance: (balance: number) => void;
    resetVirtualBalance: () => void;
    resetVirtualAccount: () => void;
    runBacktest: (strategyId: string, candles: any[], overrideSymbol?: string) => void;
}


export const useStrategyStore = create<StrategyState>()(
    persist(
        (set) => ({
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
            addSignal: (signal) => set((state) => ({
                signals: [signal, ...state.signals.slice(0, 49)]
            })),
            updateLastSignalTime: (strategyId, timestamp) => set((state) => ({
                strategies: state.strategies.map(s => s.id === strategyId ? { ...s, lastSignalTime: timestamp } : s)
            })),
            addVirtualPosition: (pos) => set((state) => ({
                virtualPositions: [...state.virtualPositions, pos]
            })),
            cancelVirtualPosition: (strategyId: string, symbol: string) => set((state) => ({
                virtualPositions: state.virtualPositions.filter(p => !(p.strategyId === strategyId && p.symbol === symbol && p.status === 'pending'))
            })),
            closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number) => set((state) => {
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
                            pnl: tradePnL
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
                virtualBalance: state.initialVirtualBalance
            })),
            runBacktest: (strategyId: string, candles: any[], overrideSymbol?: string) => set((state) => {
                const strategy = state.strategies.find(s => s.id === strategyId);
                if (!strategy) return {};

                // Dynamically import runner to avoid circular dependency issues in store initialization if any
                // But for now assuming direct import or we move logic here. 
                // Actually best to keep logic outside. We will import BacktestRunner at top.

                const { BacktestRunner } = require('../logic/BacktestRunner');
                const backtestPositions = BacktestRunner.run(strategy, candles, state.initialVirtualBalance, overrideSymbol);

                // Merge strategies: Remove old backtest positions for this strategy
                const otherPositions = state.virtualPositions.filter(p => !p.id.startsWith('bt-'));

                // Calculate PnL impact from backtest
                const totalPnL = backtestPositions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);

                console.log(`[Store] Backtest finished. Generated ${backtestPositions.length} positions. New Balance: ${state.initialVirtualBalance + totalPnL}`);

                return {
                    virtualPositions: [...otherPositions, ...backtestPositions],
                    // Option: Reset balance to initial + backtest result? 
                    // Or just add to current? Reset seems safer for consistent backtest view
                    virtualBalance: state.initialVirtualBalance + totalPnL
                };
            }),
        }),

        {
            name: 'strategy-storage',
        }
    )
);
