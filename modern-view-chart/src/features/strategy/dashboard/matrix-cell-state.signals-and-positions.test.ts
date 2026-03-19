import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrixCellState } from './matrix-cell-state';
import type { Strategy, StrategySignal, VirtualPosition } from '../types';
import type { Candle } from '@/lib/store/types';
import { baseStrategy, cfg, makeCandles } from './matrix-cell-state.test.helpers';

describe('matrix-cell-state - signals and positions', () => {
    it('maps BUY/SELL/EXIT/CANCEL into cell signal', () => {
        const now = Date.now();
        const base = { symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [baseStrategy], virtualPositions: [] as VirtualPosition[], matrixConfig: cfg, nowMs: now };
        const buySignal: StrategySignal = { type: 'BUY', symbol: 'XAUUSDm', strategyId: 's1', timestamp: now - 10000, price: 1, risk: baseStrategy.risk! };
        assert.equal(buildMatrixCellState({ ...base, signals: [buySignal] }).signal, 'BUY');
        assert.equal(buildMatrixCellState({ ...base, signals: [{ ...buySignal, type: 'SELL' }] }).signal, 'SELL');
        assert.equal(buildMatrixCellState({ ...base, signals: [{ ...buySignal, type: 'EXIT' }] }).signal, 'NO_TRADE');
        assert.equal(buildMatrixCellState({ ...base, signals: [{ ...buySignal, type: 'CANCEL' }] }).signal, 'NO_TRADE');
    });

    it('marks stale signal as NO_TRADE', () => {
        const now = Date.now();
        const oldSignal: StrategySignal = { type: 'BUY', symbol: 'XAUUSDm', strategyId: 's1', timestamp: now - 10 * 60_000, price: 1, risk: baseStrategy.risk! };
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [baseStrategy], signals: [oldSignal], virtualPositions: [], matrixConfig: cfg, nowMs: now });
        assert.equal(cell.signal, 'NO_TRADE');
        assert.equal(cell.stale, true);
    });

    it('prefers OPEN badge over PENDING', () => {
        const now = Date.now();
        const positions: VirtualPosition[] = [
            { id: 'p1', strategyId: 's1', symbol: 'XAUUSDm', timeframe: '1m', type: 'BUY', entryPrice: 1, sl: 0, tp: 0, lotSize: 0.1, timestamp: now, status: 'pending' },
            { id: 'p2', strategyId: 's1', symbol: 'XAUUSDm', timeframe: '1m', type: 'BUY', entryPrice: 1, sl: 0, tp: 0, lotSize: 0.1, timestamp: now, status: 'open' },
        ];
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [baseStrategy], signals: [], virtualPositions: positions, matrixConfig: cfg, nowMs: now });
        assert.equal(cell.badge, 'OPEN');
        assert.equal(cell.signal, 'BUY');
    });

    it('uses position side for signal when active position exists but no fresh signal', () => {
        const now = Date.now();
        const positions: VirtualPosition[] = [{ id: 'p-open-buy', strategyId: 's1', symbol: 'XAUUSDm', timeframe: '1m', type: 'BUY', entryPrice: 1, sl: 0, tp: 0, lotSize: 0.1, timestamp: now, status: 'open' }];
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [baseStrategy], signals: [], virtualPositions: positions, matrixConfig: cfg, nowMs: now });
        assert.equal(cell.signal, 'BUY');
        assert.equal(cell.badge, 'OPEN');
    });

    it('prefers active position side over conflicting fresh signal', () => {
        const now = Date.now();
        const positions: VirtualPosition[] = [{ id: 'p-open-sell', strategyId: 's1', symbol: 'XAUUSDm', timeframe: '1m', type: 'SELL', entryPrice: 1, sl: 0, tp: 0, lotSize: 0.1, timestamp: now, status: 'open' }];
        const signals: StrategySignal[] = [{ type: 'BUY', symbol: 'XAUUSDm', strategyId: 's1', timestamp: now - 1000, price: 1, risk: baseStrategy.risk! }];
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [baseStrategy], signals, virtualPositions: positions, matrixConfig: cfg, nowMs: now });
        assert.equal(cell.signal, 'SELL');
        assert.equal(cell.badge, 'OPEN');
    });

    it('does not leak open positions across timeframes for the same symbol', () => {
        const now = Date.now();
        const positions: VirtualPosition[] = [{ id: 'p-open-buy-5m', strategyId: 's1', symbol: 'XAUUSDm', timeframe: '5m', type: 'BUY', entryPrice: 1, sl: 0, tp: 0, lotSize: 0.1, timestamp: now, status: 'open' }];
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [baseStrategy], signals: [], virtualPositions: positions, matrixConfig: cfg, nowMs: now });
        assert.equal(cell.signal, 'NO_TRADE');
        assert.equal(cell.badge, null);
    });

    it('uses entry-condition readiness from candles when available', () => {
        const strategy: Strategy = { ...baseStrategy, side: 'BUY', entry: { operator: 'AND', conditions: [{ id: 'rsi-ready', left: { type: 'RSI', params: [14] }, comparator: '>', right: 0 }] } };
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [strategy], signals: [], virtualPositions: [], matrixConfig: cfg, getCandles: () => makeCandles(30) });
        assert.equal(cell.signal, 'BUY');
        assert.equal(cell.stale, false);
    });

    it('forces NO_TRADE when candles are stale', () => {
        const now = Date.now();
        const oldSec = Math.floor((now - 20 * 60_000) / 1000);
        const oldCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({ time: oldSec - (30 - i) * 60, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i }));
        const strategy: Strategy = { ...baseStrategy, side: 'BUY', entry: { operator: 'AND', conditions: [{ id: 'rsi-ready', left: { type: 'RSI', params: [14] }, comparator: '>', right: 0 }] } };
        const cell = buildMatrixCellState({ symbol: 'XAUUSDm', timeframe: '1m', strategyId: 's1', strategies: [strategy], signals: [], virtualPositions: [], matrixConfig: cfg, getCandles: () => oldCandles, nowMs: now });
        assert.equal(cell.signal, 'NO_TRADE');
        assert.equal(cell.stale, true);
    });
});
