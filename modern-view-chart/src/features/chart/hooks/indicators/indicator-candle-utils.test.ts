import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getIntervalSeconds } from './indicator-candle-utils';

describe('indicator candle interval duration', () => {
    it('uses day and week boundaries for legacy D/W intervals', () => {
        assert.equal(getIntervalSeconds('D'), 86400);
        assert.equal(getIntervalSeconds('W'), 604800);
    });

    it('keeps canonical minute intervals unchanged', () => {
        assert.equal(getIntervalSeconds('1440'), 86400);
        assert.equal(getIntervalSeconds('10080'), 604800);
    });
});
