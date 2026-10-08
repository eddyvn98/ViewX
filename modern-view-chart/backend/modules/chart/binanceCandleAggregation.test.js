import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateBinanceCandles } from './binanceCandleAggregation.js';
import { getBinanceUpstreamLimit, resolveBinanceInterval } from './binanceIntervals.js';

test('10 minute Binance candles are derived from native 5 minute candles', () => {
    const plan = resolveBinanceInterval('10');
    assert.equal(plan.upstream, '5m');
    assert.equal(plan.aggregate, '10m');
    assert.equal(getBinanceUpstreamLimit('10', 500), 1000);

    const candles = aggregateBinanceCandles([
        { time: 1_800, open: 10, high: 12, low: 9, close: 11, volume: 2 },
        { time: 2_100, open: 11, high: 14, low: 10, close: 13, volume: 3 },
    ], '10');

    assert.deepEqual(candles, [
        { time: 1_800, open: 10, high: 14, low: 9, close: 13, volume: 5 },
    ]);
});

test('yearly Binance candles are derived from native monthly candles', () => {
    const jan = Date.UTC(2025, 0, 1) / 1000;
    const feb = Date.UTC(2025, 1, 1) / 1000;
    const plan = resolveBinanceInterval('525600');
    assert.equal(plan.upstream, '1M');
    assert.equal(plan.aggregate, '1Y');

    const candles = aggregateBinanceCandles([
        { time: jan, open: 100, high: 120, low: 90, close: 110, volume: 20 },
        { time: feb, open: 110, high: 130, low: 105, close: 125, volume: 30 },
    ], '525600');

    assert.deepEqual(candles, [{
        time: jan,
        open: 100,
        high: 130,
        low: 90,
        close: 125,
        volume: 50,
    }]);
});

test('native Binance timeframes pass through without aggregation', () => {
    const plan = resolveBinanceInterval('240');
    assert.equal(plan.upstream, '4h');
    assert.equal(plan.aggregate, null);
});
