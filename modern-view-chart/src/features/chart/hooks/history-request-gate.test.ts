import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildHistoryRequestKey,
    completeHistoryRequest,
    resetHistoryRequestGate,
    tryStartHistoryRequest,
} from './history-request-gate';

test('history request key is stable per source symbol timeframe', () => {
    assert.equal(
        buildHistoryRequestKey('mt5', 'xauusdm', '15'),
        'MT5|XAUUSDM|15',
    );
});

test('duplicate history request is blocked until completed', () => {
    resetHistoryRequestGate();
    const key = buildHistoryRequestKey('MT5', 'XAUUSDm', '15');

    assert.equal(tryStartHistoryRequest(key, 1000, 10_000), true);
    assert.equal(tryStartHistoryRequest(key, 1500, 10_000), false);

    completeHistoryRequest(key);
    assert.equal(tryStartHistoryRequest(key, 1600, 10_000), true);
});

test('stalled history request can retry after timeout', () => {
    resetHistoryRequestGate();
    const key = buildHistoryRequestKey('MT5', 'EURUSDm', '5');

    assert.equal(tryStartHistoryRequest(key, 1000, 10_000), true);
    assert.equal(tryStartHistoryRequest(key, 10_999, 10_000), false);
    assert.equal(tryStartHistoryRequest(key, 11_000, 10_000), true);
});
