import assert from 'node:assert/strict';
import test from 'node:test';
import { toBinanceInterval } from './binanceIntervals.js';

test('maps app minute timeframe IDs to Binance intervals', () => {
    assert.equal(toBinanceInterval('1'), '1m');
    assert.equal(toBinanceInterval('60'), '1h');
    assert.equal(toBinanceInterval('240'), '4h');
});

test('maps long timeframe aliases to Binance intervals', () => {
    assert.equal(toBinanceInterval('D'), '1d');
    assert.equal(toBinanceInterval('10080'), '1w');
    assert.equal(toBinanceInterval('43200'), '1M');
});
