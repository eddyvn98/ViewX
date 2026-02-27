import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { managePositionOnTick } from './position-management';
import { processStrategySignal } from './signal-flow';
import { IndicatorCalculator } from '../../logic/IndicatorCalculator';
import { AiManager } from '../../logic/AiManager';
import { TradeLogger } from '../../logic/TradeLogger';
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
                updateLastSignalTime: 0,
                messages: [] as unknown[]
            };

            const store = {
                virtualPositions: [
                    makeVirtualPosition({ id: 'pending-1', status: 'pending' }),
                    makeVirtualPosition({ id: 'open-1', status: 'open' })
                ],
                virtualBalance: 10000,
                addVirtualPosition: () => {},
                closeVirtualPosition: () => { calls.close += 1; },
                cancelVirtualPosition: () => { calls.cancel += 1; },
                addSignal: () => { calls.addSignal += 1; },
                updateLastSignalTime: () => { calls.updateLastSignalTime += 1; }
            };

            const strategy = makeStrategy({ executionMode: 'real', magic: 123 });
            const candles = [makeCandle()];
            const sendMessage = (data: unknown) => calls.messages.push(data);

            processStrategySignal(
                strategy,
                {
                    type: 'CANCEL',
                    symbol: 'EURUSD',
                    strategyId: 's1',
                    timestamp: FIXED_NOW_MS,
                    price: 1.1,
                    risk: strategy.risk
                },
                'EURUSD',
                candles,
                candles[0],
                store.virtualPositions,
                store,
                sendMessage,
                FIXED_NOW_MS
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
                    risk: strategy.risk
                },
                'EURUSD',
                candles,
                candles[0],
                [{ ...makeVirtualPosition({ id: 'pending-exit', status: 'pending' }) }],
                store,
                sendMessage,
                FIXED_NOW_MS
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
                    risk: strategy.risk
                },
                'EURUSD',
                candles,
                candles[0],
                [{ ...makeVirtualPosition({ id: 'open-exit', status: 'open' }) }],
                store,
                sendMessage,
                FIXED_NOW_MS
            );

            assert.equal(calls.close, 1);
            assert.equal(calls.addSignal, 2);
            assert.ok(calls.messages.length >= 3);
        } finally {
            AiManager.processSignal = originalProcessSignal;
            TradeLogger.updateExit = originalUpdateExit;
        }
    });
});
