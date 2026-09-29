import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrixCellState, buildMatrixRunnerConfigs } from './matrix-cell-state';
import { getMatrixCandleRequests } from '@/hooks/use-websocket/senders';
import type { Strategy, StrategySignal } from '../types';
import type { MatrixScannerConfig } from './matrix-types';
import { baseStrategy, cfg, makeCandles } from './matrix-cell-state.test.helpers';

describe('matrix-cell-state - scanner and scope', () => {
    it('uses scanner timeframe in matrix mode instead of hiding cells by the bot default timeframe', () => {
        const m1OnlyStrategy: Strategy = {
            ...baseStrategy,
            timeframe: '1m',
            side: 'BUY',
            entry: { operator: 'AND', conditions: [{ id: 'rsi-ready', left: { type: 'RSI', params: [14] }, comparator: '>', right: 0 }] },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '4h',
            strategyId: 's1',
            strategies: [m1OnlyStrategy],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => makeCandles(50),
        });

        assert.equal(cell.signal, 'BUY');
    });

    it('does not paint entry readiness while the selected bot is paused', () => {
        const paused: Strategy = {
            ...baseStrategy,
            active: false,
            side: 'BUY',
            entry: { operator: 'AND', conditions: [{ id: 'buy-ready', left: { type: 'Price', params: [] }, comparator: '>', right: 0 }] },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategyId: 's1',
            strategies: [paused],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => makeCandles(30),
        });

        assert.equal(cell.signal, 'NO_TRADE');
        assert.equal(cell.badge, null);
    });

    it('requires Entry Setup trigger when it is configured', () => {
        const strategy: Strategy = {
            ...baseStrategy,
            side: 'BUY',
            entry: { operator: 'AND', conditions: [{ id: 'entry-ready', left: { type: 'Price', params: [] }, comparator: '>', right: 0 }] },
            trigger: { operator: 'AND', conditions: [{ id: 'trigger-blocked', left: { type: 'Price', params: [] }, comparator: '<', right: 0 }] },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategyId: 's1',
            strategies: [strategy],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => makeCandles(30),
        });

        assert.equal(cell.signal, 'NO_TRADE');
    });

    it('filters latest signals by timeframe scope before painting a cell', () => {
        const now = Date.now();
        const scoped15mSignal: StrategySignal = {
            type: 'BUY',
            symbol: 'XAUUSDm',
            strategyId: 's1',
            timestamp: now - 1000,
            timeframe: '15m',
            price: 1,
            risk: baseStrategy.risk!,
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategyId: 's1',
            strategies: [baseStrategy],
            signals: [scoped15mSignal],
            virtualPositions: [],
            matrixConfig: cfg,
            nowMs: now,
        });

        assert.equal(cell.signal, 'NO_TRADE');
    });

    it('only evaluates selected strategy id in matrix scanner', () => {
        const buyStrategy: Strategy = {
            ...baseStrategy,
            id: 'buy-strategy',
            side: 'BUY',
            entry: { operator: 'AND', conditions: [{ id: 'buy-ready', left: { type: 'RSI', params: [14] }, comparator: '>', right: 0 }] },
        };
        const sellStrategy: Strategy = {
            ...baseStrategy,
            id: 'sell-strategy',
            side: 'SELL',
            entry: { operator: 'AND', conditions: [{ id: 'sell-ready', left: { type: 'RSI', params: [14] }, comparator: '>', right: 0 }] },
        };

        const cell = buildMatrixCellState({
            symbol: 'XAUUSDm',
            timeframe: '1m',
            strategyId: 'sell-strategy',
            strategies: [buyStrategy, sellStrategy],
            signals: [],
            virtualPositions: [],
            matrixConfig: cfg,
            getCandles: () => makeCandles(30),
        });

        assert.equal(cell.signal, 'SELL');
    });

    it('builds runner configs from active scanners only', () => {
        const scanners: MatrixScannerConfig[] = [
            { id: 'scanner-1', name: 'Scanner 1', strategyId: 's1', active: true, symbols: ['XAUUSDm'], timeframes: ['1m', '5m'], symbolSortMode: 'added', signalTtlMultiplier: 2, signalTtlFloorSec: 60 },
            { id: 'scanner-2', name: 'Scanner 2', strategyId: null, active: true, symbols: ['BTCUSDm'], timeframes: ['1m'], symbolSortMode: 'added', signalTtlMultiplier: 2, signalTtlFloorSec: 60 },
            { id: 'scanner-3', name: 'Scanner 3', strategyId: 's2', active: false, symbols: ['EURUSDm'], timeframes: ['1m'], symbolSortMode: 'added', signalTtlMultiplier: 2, signalTtlFloorSec: 60 },
        ];
        const configs = buildMatrixRunnerConfigs(scanners);
        assert.equal(configs.length, 2);
        assert.ok(configs.every((row) => row.scannerId === 'scanner-1' && row.strategyId === 's1'));
    });

    it('dedupes identical bot symbol timeframe scopes across multiple scanners', () => {
        const scanners: MatrixScannerConfig[] = [
            { id: 'scanner-a', name: 'A', strategyId: 's1', active: true, symbols: ['XAUUSDm'], timeframes: ['5m'], symbolSortMode: 'added', signalTtlMultiplier: 2, signalTtlFloorSec: 60 },
            { id: 'scanner-b', name: 'B', strategyId: 's1', active: true, symbols: ['XAUUSDm'], timeframes: ['5m'], symbolSortMode: 'added', signalTtlMultiplier: 2, signalTtlFloorSec: 60 },
        ];

        const configs = buildMatrixRunnerConfigs(scanners);

        assert.equal(configs.length, 1);
        assert.equal(configs[0]?.strategyId, 's1');
        assert.equal(configs[0]?.symbol, 'XAUUSDm');
        assert.equal(configs[0]?.timeframe, '5m');
    });

    it('requests candles for every active scanner cell, even when it is not an open chart', () => {
        const requests = getMatrixCandleRequests([
            { id: 'scanner-1', name: 'Scanner 1', strategyId: 's1', active: true, symbols: ['XAUUSDm'], timeframes: ['1h', '4h', '1d'], symbolSortMode: 'added', signalTtlMultiplier: 2, signalTtlFloorSec: 60 },
        ]);

        assert.deepEqual(requests, [
            { source: 'MT5', symbol: 'XAUUSDm', interval: '60' },
            { source: 'MT5', symbol: 'XAUUSDm', interval: '240' },
            { source: 'MT5', symbol: 'XAUUSDm', interval: '1440' },
        ]);
    });
});
