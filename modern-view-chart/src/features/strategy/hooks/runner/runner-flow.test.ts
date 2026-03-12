import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { managePositionOnTick } from './position-management';
import { processStrategySignal } from './signal-flow';
import { IndicatorCalculator } from '../../logic/IndicatorCalculator';
import { AiManager } from '../../logic/AiManager';
import { TradeLogger } from '../../logic/TradeLogger';
import { soundService } from '../../logic/SoundService';
import type { Strategy, StrategySignal, VirtualPosition } from '../../types';
import type { Candle } from '@/lib/store/types';

const FIXED_NOW_MS = 1700000000000;

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
    return {
        id: 's1',
        name: 'Test Strategy',
        side: 'BUY',
        entry: { operator: 'AND', conditions: [] },
        risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 },
        active: true,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        ...overrides
    };
}

function makeVirtualPosition(overrides: Partial<VirtualPosition> = {}): VirtualPosition {
    return {
        id: 'v1',
        strategyId: 's1',
        symbol: 'EURUSD',
        timeframe: '1m',
        matrixScopeKey: 's1:EURUSD:1m',
        openedBarTime: 123,
        type: 'BUY',
        entryPrice: 1.1,
        sl: 1.09,
        tp: 1.12,
        lotSize: 0.1,
        timestamp: FIXED_NOW_MS - 10000,
        status: 'open',
        ...overrides
    };
}

function makeCandle(overrides: Partial<Candle> = {}): Candle {
    return {
        time: FIXED_NOW_MS,
        open: 1.1,
        high: 1.11,
        low: 1.09,
        close: 1.105,
        volume: 100,
        ...overrides
    };
}

describe('runner flow behavior', () => {
    it('trailing SL update keeps sl_time on update payload', () => {
        const originalNow = Date.now;
        const originalGetLastValue = IndicatorCalculator.getLastValue;
        Date.now = () => FIXED_NOW_MS;
        IndicatorCalculator.getLastValue = () => 1.095;

        try {
            const updates: Array<{ id: string; updates: Partial<VirtualPosition> }> = [];
            const store = {
                updateVirtualPosition: (id: string, nextUpdates: Partial<VirtualPosition>) => {
                    updates.push({ id, updates: nextUpdates });
                },
                closeVirtualPosition: () => {}
            };

            const strategy = makeStrategy({ risk: { trailing: true, trailingSource: 'HA_Low', lotSize: 0.1, sl: 20, tp: 40 } });
            const position = makeVirtualPosition({ sl: 1.09, status: 'open' });
            const candles = [makeCandle({ close: 1.102 }), makeCandle({ close: 1.104 })];

            managePositionOnTick(strategy, position, 'EURUSD', candles, candles[candles.length - 1], true, store);

            const slUpdate = updates.find((u) => typeof u.updates.sl_time === 'number');
            assert.ok(slUpdate);
            assert.equal(slUpdate?.updates.sl, 1.095);
            assert.equal(slUpdate?.updates.sl_time, Math.floor(FIXED_NOW_MS / 1000));
        } finally {
            Date.now = originalNow;
            IndicatorCalculator.getLastValue = originalGetLastValue;
        }
    });

    it('pending position becomes open and refreshes entry_time when filled', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;

        try {
            const updates: Array<{ id: string; updates: Partial<VirtualPosition> }> = [];
            const store = {
                updateVirtualPosition: (id: string, nextUpdates: Partial<VirtualPosition>) => {
                    updates.push({ id, updates: nextUpdates });
                },
                closeVirtualPosition: () => {}
            };

            const strategy = makeStrategy({ risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 } });
            const pending = makeVirtualPosition({ status: 'pending', entryPrice: 1.101 });
            const candle = makeCandle({ close: 1.102, high: 1.103, low: 1.1 });

            managePositionOnTick(strategy, pending, 'EURUSD', [candle], candle, true, store);

            assert.equal(updates.length, 1);
            assert.equal(updates[0].updates.status, 'open');
            assert.equal(updates[0].updates.entry_time, Math.floor(FIXED_NOW_MS / 1000));
            assert.equal(updates[0].updates.timestamp, FIXED_NOW_MS);
        } finally {
            Date.now = originalNow;
        }
    });

    it('routes CANCEL and EXIT signals to the correct store branch', async () => {
        const originalProcessSignal = AiManager.processSignal;
        const originalUpdateExit = TradeLogger.updateExit;

        AiManager.processSignal = (signal: StrategySignal) => signal;
        TradeLogger.updateExit = async () => {};

        try {
            const calls = {
                cancel: 0,
                close: 0,
                addSignal: 0,
                updateLastSignalTime: 0
            };

            const store = {
                virtualPositions: [
                    makeVirtualPosition({ id: 'pending-1', status: 'pending' }),
                    makeVirtualPosition({ id: 'open-1', status: 'open' })
                ],
                signals: [],
                virtualBalance: 10000,
                addVirtualPosition: () => {},
                closeVirtualPosition: () => { calls.close += 1; },
                cancelVirtualPosition: () => { calls.cancel += 1; },
                addSignal: () => { calls.addSignal += 1; },
                updateLastSignalTime: () => { calls.updateLastSignalTime += 1; }
            };

            const strategy = makeStrategy({ executionMode: 'real', magic: 123 });
            const candles = [makeCandle()];

            processStrategySignal(
                strategy,
                {
                    type: 'CANCEL',
                    symbol: 'EURUSD',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS,
                    price: 1.1,
                    risk: strategy.risk!,
                    direction: 'BUY',
                },
                'EURUSD',
                '1m',
                candles,
                candles[0],
                store.virtualPositions,
                store,
                FIXED_NOW_MS,
                'MT5',
                's1:EURUSD:1m'
            );

            assert.equal(calls.cancel, 1);
            assert.equal(calls.close, 0);
            assert.equal(calls.addSignal, 0);

            processStrategySignal(
                strategy,
                {
                    type: 'EXIT',
                    symbol: 'EURUSD',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS + 1,
                    price: 1.099,
                    risk: strategy.risk!,
                    direction: 'BUY',
                },
                'EURUSD',
                '1m',
                candles,
                candles[0],
                [{ ...makeVirtualPosition({ id: 'pending-exit', status: 'pending' }) }],
                store,
                FIXED_NOW_MS,
                'MT5',
                's1:EURUSD:1m'
            );

            assert.equal(calls.cancel, 2);
            assert.equal(calls.close, 0);
            assert.equal(calls.addSignal, 1);

            processStrategySignal(
                strategy,
                {
                    type: 'EXIT',
                    symbol: 'EURUSD',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS + 2,
                    price: 1.098,
                    risk: strategy.risk!,
                    direction: 'BUY',
                },
                'EURUSD',
                '1m',
                candles,
                candles[0],
                [{ ...makeVirtualPosition({ id: 'open-exit', status: 'open' }) }],
                store,
                FIXED_NOW_MS,
                'MT5',
                's1:EURUSD:1m'
            );

            assert.equal(calls.close, 1);
            assert.equal(calls.addSignal, 2);
        } finally {
            AiManager.processSignal = originalProcessSignal;
            TradeLogger.updateExit = originalUpdateExit;
        }
    });

    it('scopes CANCEL by matrixScopeKey so another timeframe is untouched', () => {
        const originalProcessSignal = AiManager.processSignal;
        AiManager.processSignal = (signal: StrategySignal) => signal;

        try {
            const canceled: string[] = [];
            const store = {
                virtualPositions: [
                    makeVirtualPosition({ id: 'm1', status: 'pending', matrixScopeKey: 's1:EURUSD:1m', timeframe: '1m' }),
                    makeVirtualPosition({ id: 'm5', status: 'pending', matrixScopeKey: 's1:EURUSD:5m', timeframe: '5m' }),
                ],
                signals: [],
                virtualBalance: 10000,
                addVirtualPosition: () => {},
                closeVirtualPosition: () => {},
                cancelVirtualPosition: (_strategyId: string, _symbol: string, _direction?: 'BUY' | 'SELL', scope?: string) => { if (scope) canceled.push(scope); },
                addSignal: () => {},
                updateLastSignalTime: () => {}
            };

            const strategy = makeStrategy();
            const candles = [makeCandle()];

            processStrategySignal(
                strategy,
                { type: 'CANCEL', symbol: 'EURUSD', strategyId: 's1', timestamp: FIXED_NOW_MS, price: 1.1, risk: strategy.risk!, direction: 'BUY' },
                'EURUSD',
                '1m',
                candles,
                candles[0],
                store.virtualPositions,
                store,
                FIXED_NOW_MS,
                'MT5',
                's1:EURUSD:1m'
            );

            assert.deepEqual(canceled, ['s1:EURUSD:1m']);
        } finally {
            AiManager.processSignal = originalProcessSignal;
        }
    });

    it('skips duplicate entries for the same bar after reload', () => {
        const originalProcessSignal = AiManager.processSignal;
        AiManager.processSignal = (signal: StrategySignal) => signal;

        try {
            let added = 0;
            let lastSignalTimeUpdates = 0;
            const store = {
                virtualPositions: [
                    makeVirtualPosition({
                        id: 'existing-open',
                        status: 'open',
                        openedBarTime: 111,
                        type: 'SELL',
                        matrixScopeKey: 's1:XAUUSDm:5m',
                        timeframe: '5m',
                        symbol: 'XAUUSDm',
                    }),
                ],
                signals: [
                    {
                        type: 'SELL' as const,
                        symbol: 'XAUUSDm',
                        strategyId: 's1',
                        timestamp: FIXED_NOW_MS - 1000,
                        barTime: 111,
                        price: 5190,
                        risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 },
                        timeframe: '5m',
                        matrixScopeKey: 's1:XAUUSDm:5m',
                    },
                ],
                virtualBalance: 10000,
                addVirtualPosition: () => { added += 1; },
                closeVirtualPosition: () => {},
                cancelVirtualPosition: () => {},
                addSignal: () => {},
                updateLastSignalTime: () => { lastSignalTimeUpdates += 1; },
            };

            const strategy = makeStrategy({
                positionMode: 'scale_in',
                executionMode: 'virtual',
                sell: {
                    entry: { operator: 'AND', conditions: [] },
                    risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40, maxTrades: 5 },
                } as Strategy['sell'],
            });
            const candles = [makeCandle({ close: 5190 })];

            processStrategySignal(
                strategy,
                {
                    type: 'SELL',
                    symbol: 'XAUUSDm',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS,
                    price: 5190,
                    risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 },
                    direction: 'SELL',
                },
                'XAUUSDm',
                '5m',
                candles,
                candles[0],
                store.virtualPositions,
                store,
                111,
                'MT5',
                's1:XAUUSDm:5m'
            );

            assert.equal(added, 0);
            assert.equal(lastSignalTimeUpdates, 1);
        } finally {
            AiManager.processSignal = originalProcessSignal;
        }
    });

    it('blocks new matrix entry after reload when the scope already has a live trade', () => {
        const originalProcessSignal = AiManager.processSignal;
        AiManager.processSignal = (signal: StrategySignal) => signal;

        try {
            let added = 0;
            let lastSignalTimeUpdates = 0;
            const store = {
                virtualPositions: [
                    makeVirtualPosition({
                        id: 'existing-open',
                        status: 'open',
                        openedBarTime: 100,
                        type: 'BUY',
                        matrixScopeKey: 's1:XAUUSDm:15m',
                        timeframe: '15m',
                        symbol: 'XAUUSDm',
                    }),
                ],
                signals: [],
                virtualBalance: 10000,
                addVirtualPosition: () => { added += 1; },
                closeVirtualPosition: () => {},
                cancelVirtualPosition: () => {},
                addSignal: () => {},
                updateLastSignalTime: () => { lastSignalTimeUpdates += 1; },
            };

            const strategy = makeStrategy({
                positionMode: 'scale_in',
                executionMode: 'virtual',
                lockMatrixScopeWhileOpen: true,
                buy: {
                    entry: { operator: 'AND', conditions: [] },
                    risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40, maxTrades: 5 },
                    positionMode: 'scale_in',
                    lockMatrixScopeWhileOpen: true,
                } as Strategy['buy'],
            });
            const candles = [makeCandle({ close: 5180 })];

            processStrategySignal(
                strategy,
                {
                    type: 'BUY',
                    symbol: 'XAUUSDm',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS,
                    price: 5180,
                    risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 },
                    direction: 'BUY',
                },
                'XAUUSDm',
                '15m',
                candles,
                candles[0],
                store.virtualPositions,
                store,
                222,
                'MT5',
                's1:XAUUSDm:15m'
            );

            assert.equal(added, 0);
            assert.equal(lastSignalTimeUpdates, 1);
        } finally {
            AiManager.processSignal = originalProcessSignal;
        }
    });

    it('still allows scale-in matrix entries when scoped live-trade lock is off', () => {
        const originalProcessSignal = AiManager.processSignal;
        const originalPlayBuy = soundService.playBuy;
        AiManager.processSignal = (signal: StrategySignal) => signal;
        soundService.playBuy = () => {};

        try {
            let added = 0;
            const store = {
                virtualPositions: [
                    makeVirtualPosition({
                        id: 'existing-open',
                        status: 'open',
                        openedBarTime: 100,
                        type: 'BUY',
                        matrixScopeKey: 's1:XAUUSDm:15m',
                        timeframe: '15m',
                        symbol: 'XAUUSDm',
                    }),
                ],
                signals: [],
                virtualBalance: 10000,
                addVirtualPosition: () => { added += 1; },
                closeVirtualPosition: () => {},
                cancelVirtualPosition: () => {},
                addSignal: () => {},
                updateLastSignalTime: () => {},
            };

            const strategy = makeStrategy({
                positionMode: 'scale_in',
                executionMode: 'virtual',
                buy: {
                    entry: { operator: 'AND', conditions: [] },
                    risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40, maxTrades: 5 },
                    positionMode: 'scale_in',
                } as Strategy['buy'],
            });
            const candles = [makeCandle({ close: 5180 })];

            processStrategySignal(
                strategy,
                {
                    type: 'BUY',
                    symbol: 'XAUUSDm',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS,
                    price: 5180,
                    risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 },
                    direction: 'BUY',
                },
                'XAUUSDm',
                '15m',
                candles,
                candles[0],
                store.virtualPositions,
                store,
                222,
                'MT5',
                's1:XAUUSDm:15m'
            );

            assert.equal(added, 1);
        } finally {
            AiManager.processSignal = originalProcessSignal;
            soundService.playBuy = originalPlayBuy;
        }
    });
});
