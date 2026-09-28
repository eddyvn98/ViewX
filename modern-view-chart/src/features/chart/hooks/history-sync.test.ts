import test from 'node:test';
import assert from 'node:assert/strict';
import { getIncrementalHistoryCount } from './history-sync';

test('cold history uses initial batch', () => {
    assert.equal(getIncrementalHistoryCount(undefined, 100_000, 900), 300);
});

test('fresh cache needs no history request', () => {
    assert.equal(getIncrementalHistoryCount(99_500, 100_000, 900), 0);
});

test('stale cache requests only missing bars plus overlap', () => {
    const last = 1_000_000;
    const now = last + 41 * 900;
    assert.equal(getIncrementalHistoryCount(last, now, 900), 43);
});

test('incremental request is capped', () => {
    assert.equal(
        getIncrementalHistoryCount(1, 10_000_000, 60, { maxCount: 5000 }),
        5000,
    );
});
