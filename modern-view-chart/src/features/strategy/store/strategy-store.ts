import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Strategy, StrategySignal, VirtualPosition } from '../types';

interface StrategyState {
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
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
    clearSignals: () => void;
    clearVirtualPositions: () => void;
}

export const useStrategyStore = create<StrategyState>()(
    persist(
        (set) => ({
            strategies: [
                {
                    id: 'hull-ha-gold-buy',
                    name: 'Hull HA Gold Scalper (BUY)',
                    symbol: 'XAUUSDm',
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
                        sl: 30, // Fallback if source fails
                        tp: 60,
                        trailing: true,
                        slSource: 'HA_Low',
                        trailingSource: 'HA_Low',
                        lotSize: 0.1
                    }
                },
                {
                    id: 'hull-ha-gold-sell',
                    name: 'Hull HA Gold Scalper (SELL)',
                    symbol: 'XAUUSDm',
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
                        sl: 30, // Fallback
                        tp: 60,
                        trailing: true,
                        slSource: 'HA_High',
                        trailingSource: 'HA_High',
                        lotSize: 0.1
                    }
                },
                {
                    id: 'test-trigger-rsi',
                    name: 'Test Fast Trigger (RSI > 20)',
                    symbol: 'XAUUSDm',
                    active: true,
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
            closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number) => set((state) => ({
                virtualPositions: state.virtualPositions.map(p =>
                    p.strategyId === strategyId && p.symbol === symbol && (p.status === 'open' || p.status === 'pending')
                        ? { ...p, status: 'closed', exitPrice, pnl: (exitPrice - p.entryPrice) * (p.type === 'BUY' ? 1 : -1) * (p.lotSize * 100000) }
                        : p
                )
            })),
            updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => set((state) => ({
                virtualPositions: state.virtualPositions.map(p => p.id === id ? { ...p, ...updates } : p)
            })),
            clearSignals: () => set({ signals: [] }),
            clearVirtualPositions: () => set({ virtualPositions: [] }),
        }),
        {
            name: 'strategy-storage',
        }
    )
);
