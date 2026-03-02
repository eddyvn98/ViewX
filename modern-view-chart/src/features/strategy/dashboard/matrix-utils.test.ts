import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareTimeframe, normalizeDashboardTf, resolveCellTTL, sortSymbols, timeframeToSeconds } from './matrix-utils';

describe('matrix-utils', () => {
    it('normalizes timeframe aliases', () => {
        assert.equal(normalizeDashboardTf('60'), '1h');
        assert.equal(normalizeDashboardTf('240'), '4h');
        assert.equal(normalizeDashboardTf('1m'), '1m');
    });

    it('sorts timeframe by ascending duration', () => {
        const values = ['4h', '1m', '1d', '15m'];
        values.sort(compareTimeframe);
        assert.deepEqual(values, ['1m', '15m', '4h', '1d']);
    });

    it('sorts symbols by mode', () => {
        assert.deepEqual(sortSymbols(['XAUUSDm', 'BTCUSDm'], 'added'), ['XAUUSDm', 'BTCUSDm']);
        assert.deepEqual(sortSymbols(['XAUUSDm', 'BTCUSDm'], 'abc'), ['BTCUSDm', 'XAUUSDm']);
    });

    it('resolves ttl by floor and timeframe', () => {
        const ttl = resolveCellTTL('1h', { signalTtlMultiplier: 2, signalTtlFloorSec: 60 });
        assert.equal(ttl, 7200);
        const floorOnly = resolveCellTTL('1m', { signalTtlMultiplier: 1, signalTtlFloorSec: 300 });
        assert.equal(floorOnly, 300);
    });

    it('converts timeframe to seconds', () => {
        assert.equal(timeframeToSeconds('1m'), 60);
        assert.equal(timeframeToSeconds('1h'), 3600);
        assert.equal(timeframeToSeconds('1d'), 86400);
    });
});

