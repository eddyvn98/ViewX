import assert from 'node:assert/strict';
import test from 'node:test';
import { safeRemoveSeries } from './safe-remove-series';

test('safeRemoveSeries tolerates a series already removed by Lightweight Charts', () => {
    const chart = {
        removeSeries() {
            throw new Error('Value is undefined');
        },
    };

    assert.doesNotThrow(() => safeRemoveSeries(chart as any, {} as any, 'test'));
});

test('safeRemoveSeries does not call the chart for an empty series ref', () => {
    let calls = 0;
    const chart = { removeSeries() { calls += 1; } };

    safeRemoveSeries(chart as any, null);
    assert.equal(calls, 0);
});
