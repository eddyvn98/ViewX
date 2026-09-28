import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIntervalCandidates, parseIntervalSeconds, resolveCandles, updateSyncData } from './use-chart-history.helpers';

describe('chart history interval helpers', () => {
    it('converts canonical minute intervals to seconds', () => {
        assert.equal(parseIntervalSeconds('60'), 3600);
        assert.equal(parseIntervalSeconds('240'), 14400);
        assert.equal(parseIntervalSeconds('1440'), 86400);
        assert.equal(parseIntervalSeconds('10080'), 604800);
    });

    it('keeps legacy D and W intervals compatible with the correct candle duration', () => {
        assert.equal(parseIntervalSeconds('D'), 86400);
        assert.equal(parseIntervalSeconds('W'), 604800);
    });

    it('can find candle data stored under canonical IDs when a legacy interval is requested', () => {
        const daily = buildIntervalCandidates('D');
        const weekly = buildIntervalCandidates('W');

        assert.deepEqual(daily.slice(0, 2), ['D', '1440']);
        assert.deepEqual(weekly.slice(0, 2), ['W', '10080']);
        for (const alias of ['1440m', '1D', '1d', 'd1']) assert.ok(daily.includes(alias));
        for (const alias of ['10080m', '1W', '1w', 'w1']) assert.ok(weekly.includes(alias));

        const candles = [{ time: 1700000000, open: 1, high: 2, low: 1, close: 2 }];
        const resolved = resolveCandles(
            { candleData: { 'MT5:XAUUSDm:10080': candles } },
            'MT5',
            'XAUUSDm',
            buildIntervalCandidates('W'),
        );

        assert.equal(resolved.key, 'MT5:XAUUSDm:10080');
        assert.equal(resolved.candles, candles);
    });
});


describe('chart history sync helpers', () => {
    it('clears sync series safely when the destination context has no candles yet', () => {
        const subCalls: unknown[] = [];
        const timeCalls: unknown[] = [];
        updateSyncData(
            [],
            { current: { setData: (data) => subCalls.push(data) } },
            { current: { setData: (data) => timeCalls.push(data) } },
        );

        assert.deepEqual(subCalls, [[]]);
        assert.deepEqual(timeCalls, [[]]);
    });
});
