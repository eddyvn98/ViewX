import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrixCellState } from './matrix-cell-state';
import type { Strategy, StrategySignal, VirtualPosition } from '../types';
import type { Candle } from '@/lib/store/types';

const baseStrategy: Strategy = {
    id: 's1',
    name: 'S1',
    side: 'BUY',
    entry: { operator: 'AND', conditions: [] },
    risk: { trailing: false, lotSize: 0.1 },
    active: true,
    positionMode: 'single_position',
    executionMode: 'virtual',
    entryType: 'market',
    symbol: 'XAUUSDm',
    timeframe: '1m',
};

const cfg = { signalTtlMultiplier: 2, signalTtlFloorSec: 60 };

function makeCandles(count: number, closeStart = 100): Candle[] {
    const nowSec = Math.floor(Date.now() / 1000);
    return Array.from({ length: count }, (_, i) => {
        const close = closeStart + i;
        return {
            time: nowSec - (count - i) * 60,
            open: close - 0.5,
            high: close + 1,
            low: close - 1,
            close,
            volume: 100,
        };
    });
}

describe('matrix-cell-state', () => {
    it('maps BUY/SELL/EXIT/CANCEL into cell signal', () => {
        const now = Date.now();
        const base = {
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategies: [baseStrategy],
            virtualPositions: [] as VirtualPosition[],
            matrixConfig: cfg,
            nowMs: now,
        };
        const buySignal: StrategySignal = { type: 'BUY', symbol: 'XAUUSDm', strategyId: 's1', timestamp: now - 10_000, price: 1, risk: baseStrategy.risk };
        const sellSignal: StrategySignal = { ...buySignal, type: 'SELL' };
        const exitSignal: StrategySignal = { ...buySignal, type: 'EXIT' };
        const cancelSignal: StrategySignal = { ...buySignal, type: 'CANCEL' };

        assert.equal(buildMatrixCellState({ ...base, signals: [buySignal] }).signal, 'BUY');
        assert.equal(buildMatrixCellState({ ...base, signals: [sellSignal] }).signal, 'SELL');
        assert.equal(buildMatrixCellState({ ...base, signals: [exitSignal] }).signal, 'NO_TRADE');
        assert.equal(buildMatrixCellState({ ...base, signals: [cancelSignal] }).signal, 'NO_TRADE');
    });

    it('marks stale signal as NO_TRADE', () => {
        const now = Date.now();
        const oldSignal: StrategySignal = {
            type: 'BUY',
            symbol: 'XAUUSDm',
            strategyId: 's1',
            timestamp: now - 10 * 60_000,
            price: 1,
            risk: baseStrategy.risk,
        };
        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategies: [baseStrategy],
            signals: [oldSignal],
            virtualPositions: [],
            matrixConfig: cfg,
            nowMs: now,
        });
        assert.equal(cell.signal, 'NO_TRADE');
        assert.equal(cell.stale, true);
    });

    it('prefers OPEN badge over PENDING', () => {
        const now = Date.now();
        const positions: VirtualPosition[] = [
            {
                id: 'p1',
                strategyId: 's1',
                symbol: 'XAUUSDm',
                type: 'BUY',
                entryPrice: 1,
                sl: 0,
                tp: 0,
                lotSize: 0.1,
                timestamp: now,
                status: 'pending',
            },
            {
                id: 'p2',
                strategyId: 's1',
                symbol: 'XAUUSDm',
                type: 'BUY',
                entryPrice: 1,
                sl: 0,
                tp: 0,
                lotSize: 0.1,
                timestamp: now,
                status: 'open',
            },
        ];
        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategies: [baseStrategy],
            signals: [],
            virtualPositions: positions,
            matrixConfig: cfg,
            nowMs: now,
        });
        assert.equal(cell.badge, 'OPEN');
    });

    it('uses position side for signal when active position exists but no fresh signal', () => {
        const now = Date.now();
        const positions: VirtualPosition[] = [
            {
                id: 'p-open-buy',
                strategyId: 's1',
                symbol: 'XAUUSDm',
                type: 'BUY',
                entryPrice: 1,
                sl: 0,
                tp: 0,
                lotSize: 0.1,
                timestamp: now,
                status: 'open',
            },
        ];
        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategies: [baseStrategy],
            signals: [],
            virtualPositions: positions,
            matrixConfig: cfg,
            nowMs: now,
        });
        assert.equal(cell.signal, 'BUY');
        assert.equal(cell.badge, 'OPEN');
    });

    it('uses entry-condition readiness from candles when available', () => {
        const strategy: Strategy = {
            ...baseStrategy,
            side: 'BUY',
            entry: {
                operator: 'AND',
                conditions: [
                    {
                        id: 'rsi-ready',
                        left: { type: 'RSI', params: [14] },
                        comparator: '>',
                        right: 0,
                    },
                ],
            },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategies: [strategy],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => makeCandles(30),
        });

        assert.equal(cell.signal, 'BUY');
        assert.equal(cell.stale, false);
    });

    it('forces NO_TRADE when candles are stale', () => {
        const now = Date.now();
        const oldSec = Math.floor((now - 20 * 60_000) / 1000);
        const oldCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
            time: oldSec - (30 - i) * 60,
            open: 100 + i,
            high: 101 + i,
            low: 99 + i,
            close: 100 + i,
        }));

        const strategy: Strategy = {
            ...baseStrategy,
            side: 'BUY',
            entry: {
                operator: 'AND',
                conditions: [
                    {
                        id: 'rsi-ready',
                        left: { type: 'RSI', params: [14] },
                        comparator: '>',
                        right: 0,
                    },
                ],
            },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategies: [strategy],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => oldCandles,
            nowMs: now,
        });

        assert.equal(cell.signal, 'NO_TRADE');
        assert.equal(cell.stale, true);
    });

    it('falls back to symbol-scoped active strategies when timeframe-specific strategy is missing', () => {
        const m1OnlyStrategy: Strategy = {
            ...baseStrategy,
            timeframe: '1m',
            side: 'BUY',
            entry: {
                operator: 'AND',
                conditions: [
                    {
                        id: 'rsi-ready',
                        left: { type: 'RSI', params: [14] },
                        comparator: '>',
                        right: 0,
                    },
                ],
            },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '4h',
            strategies: [m1OnlyStrategy],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => makeCandles(50),
        });

        assert.equal(cell.signal, 'BUY');
    });
});
