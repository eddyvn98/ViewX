import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseIntervalSeconds } from './socket-config';

describe('websocket interval duration', () => {
    it('does not request weekly history using a one-minute time span', () => {
        assert.equal(parseIntervalSeconds('D'), 86400);
        assert.equal(parseIntervalSeconds('W'), 604800);
    });

    it('supports canonical minute intervals', () => {
        assert.equal(parseIntervalSeconds('60'), 3600);
        assert.equal(parseIntervalSeconds('10080'), 604800);
    });
});
