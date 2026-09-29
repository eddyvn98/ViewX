import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { processStrategySignal } from './signal-flow';
import { AiManager } from '../../logic/AiManager';
import { soundService } from '../../logic/SoundService';
import type { Strategy, StrategySignal } from '../../types';
import { FIXED_NOW_MS, makeCandle, makeStrategy, makeVirtualPosition } from './runner-flow.test.helpers';

describe('runner flow behavior - matrix guards', () => {
    it('scopes CANCEL by matrixScopeKey so another timeframe is untouched', () => {
        const originalProcessSignal = AiManager.processSignal;
        AiManager.processSignal = (signal: StrategySignal) => signal;

        try {
            const canceled: string[] = [];
            const recordedSignals: StrategySignal[] = [];
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
                addSignal: (signal: StrategySignal) => { recordedSignals.push(signal); },
                updateLastSignalTime: () => {}
            };

            const strategy = makeStrategy();
            const candles = [makeCandle()];
            processStrategySignal(strategy, { type: 'CANCEL', symbol: 'EURUSD', strategyId: 's1', timestamp: FIXED_NOW_MS, price: 1.1, risk: strategy.risk!, direction: 'BUY' }, 'EURUSD', '1m', candles, candles[0], store.virtualPositions, store, FIXED_NOW_MS, 'MT5', 's1:EURUSD:1m');
            assert.deepEqual(canceled, ['s1:EURUSD:1m']);
            assert.equal(recordedSignals.length, 1);
            assert.equal(recordedSignals[0]?.type, 'CANCEL');
            assert.equal(recordedSignals[0]?.matrixScopeKey, 's1:EURUSD:1m');
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
                virtualPositions: [makeVirtualPosition({ id: 'existing-open', status: 'open', openedBarTime: 111, type: 'SELL', matrixScopeKey: 's1:XAUUSDm:5m', timeframe: '5m', symbol: 'XAUUSDm' })],
                signals: [{ type: 'SELL' as const, symbol: 'XAUUSDm', strategyId: 's1', timestamp: FIXED_NOW_MS - 1000, barTime: 111, price: 5190, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 }, timeframe: '5m', matrixScopeKey: 's1:XAUUSDm:5m' }],
                virtualBalance: 10000,
                addVirtualPosition: () => { added += 1; },
                closeVirtualPosition: () => {},
                cancelVirtualPosition: () => {},
                addSignal: () => {},
                updateLastSignalTime: () => { lastSignalTimeUpdates += 1; },
            };

            const strategy = makeStrategy({ positionMode: 'scale_in', executionMode: 'virtual', sell: { entry: { operator: 'AND', conditions: [] }, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40, maxTrades: 5 } } as Strategy['sell'] });
            const candles = [makeCandle({ close: 5190 })];
            processStrategySignal(strategy, { type: 'SELL', symbol: 'XAUUSDm', strategyId: 's1', timestamp: FIXED_NOW_MS, price: 5190, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 }, direction: 'SELL' }, 'XAUUSDm', '5m', candles, candles[0], store.virtualPositions, store, 111, 'MT5', 's1:XAUUSDm:5m');
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
                virtualPositions: [makeVirtualPosition({ id: 'existing-open', status: 'open', openedBarTime: 100, type: 'BUY', matrixScopeKey: 's1:XAUUSDm:15m', timeframe: '15m', symbol: 'XAUUSDm' })],
                signals: [],
                virtualBalance: 10000,
                addVirtualPosition: () => { added += 1; },
                closeVirtualPosition: () => {},
                cancelVirtualPosition: () => {},
                addSignal: () => {},
                updateLastSignalTime: () => { lastSignalTimeUpdates += 1; },
            };

            const strategy = makeStrategy({ positionMode: 'scale_in', executionMode: 'virtual', lockMatrixScopeWhileOpen: true, buy: { entry: { operator: 'AND', conditions: [] }, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40, maxTrades: 5 }, positionMode: 'scale_in', lockMatrixScopeWhileOpen: true } as Strategy['buy'] });
            const candles = [makeCandle({ close: 5180 })];
            processStrategySignal(strategy, { type: 'BUY', symbol: 'XAUUSDm', strategyId: 's1', timestamp: FIXED_NOW_MS, price: 5180, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 }, direction: 'BUY' }, 'XAUUSDm', '15m', candles, candles[0], store.virtualPositions, store, 222, 'MT5', 's1:XAUUSDm:15m');
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
                virtualPositions: [makeVirtualPosition({ id: 'existing-open', status: 'open', openedBarTime: 100, type: 'BUY', matrixScopeKey: 's1:XAUUSDm:15m', timeframe: '15m', symbol: 'XAUUSDm' })],
                signals: [],
                virtualBalance: 10000,
                addVirtualPosition: () => { added += 1; },
                closeVirtualPosition: () => {},
                cancelVirtualPosition: () => {},
                addSignal: () => {},
                updateLastSignalTime: () => {},
            };

            const strategy = makeStrategy({ positionMode: 'scale_in', executionMode: 'virtual', buy: { entry: { operator: 'AND', conditions: [] }, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40, maxTrades: 5 }, positionMode: 'scale_in' } as Strategy['buy'] });
            const candles = [makeCandle({ close: 5180 })];
            processStrategySignal(strategy, { type: 'BUY', symbol: 'XAUUSDm', strategyId: 's1', timestamp: FIXED_NOW_MS, price: 5180, risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 }, direction: 'BUY' }, 'XAUUSDm', '15m', candles, candles[0], store.virtualPositions, store, 222, 'MT5', 's1:XAUUSDm:15m');
            assert.equal(added, 1);
        } finally {
            AiManager.processSignal = originalProcessSignal;
            soundService.playBuy = originalPlayBuy;
        }
    });
});
