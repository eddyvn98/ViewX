import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toEpochSec, withOrderAnchors, withPositionAnchors } from './anchor-utils';
import type { Order, Position } from '../../types';

const FIXED_NOW_MS = 1700000000000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);

function makePosition(overrides: Partial<Position> = {}): Position {
    return {
        ticket: 1,
        symbol: 'EURUSD',
        type: 'buy',
        volume: 1,
        open_price: 1.1,
        current_price: 1.1,
        sl: 1.09,
        tp: 1.12,
        profit: 0,
        time: 1699999999,
        magic: 0,
        ...overrides
    };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
    return {
        ticket: 2,
        symbol: 'EURUSD',
        type: 'buy_limit',
        volume: 1,
        price_open: 1.1,
        current_price: 1.1,
        sl: 1.09,
        tp: 1.12,
        time: 1699999999,
        magic: 0,
        ...overrides
    };
}

describe('toEpochSec', () => {
    it('normalizes seconds and milliseconds timestamps', () => {
        assert.equal(toEpochSec(1700000000), 1700000000);
        assert.equal(toEpochSec(1700000000123), 1700000000);
    });

    it('returns null for invalid values', () => {
        assert.equal(toEpochSec(undefined), null);
        assert.equal(toEpochSec('abc'), null);
        assert.equal(toEpochSec(0), null);
    });
});

describe('withPositionAnchors', () => {
    it('reuses previous anchor timestamps when current payload omits them', () => {
        const previous = makePosition({ entry_time: 1700000001, sl_time: 1700000002, tp_time: 1700000003 });
        const current = makePosition({ sl_time: undefined, tp_time: undefined, entry_time: undefined });

        const next = withPositionAnchors(current, previous);

        assert.equal(next.entry_time, 1700000001);
        assert.equal(next.sl_time, 1700000002);
        assert.equal(next.tp_time, 1700000003);
    });

    it('resets anchor times when structural fields change', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;

        try {
            const previous = makePosition({ open_price: 1.1, sl: 1.09, tp: 1.12 });
            const current = makePosition({ open_price: 1.101, sl: 1.095, tp: 0 });
            const next = withPositionAnchors(current, previous);

            assert.equal(next.entry_time, FIXED_NOW_SEC);
            assert.equal(next.sl_time, FIXED_NOW_SEC);
            assert.equal(next.tp_time, undefined);
        } finally {
            Date.now = originalNow;
        }
    });
});

describe('withOrderAnchors', () => {
    it('falls back to order time when entry_time is missing', () => {
        const current = makeOrder({ entry_time: undefined, time: 1700000100 });
        const next = withOrderAnchors(current);
        assert.equal(next.entry_time, 1700000100);
    });

    it('updates sl/tp anchor when pending order levels change', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;

        try {
            const previous = makeOrder({ price_open: 1.1, sl: 1.09, tp: 1.12 });
            const current = makeOrder({ price_open: 1.1005, sl: 0, tp: 1.125 });
            const next = withOrderAnchors(current, previous);

            assert.equal(next.entry_time, FIXED_NOW_SEC);
            assert.equal(next.sl_time, undefined);
            assert.equal(next.tp_time, FIXED_NOW_SEC);
        } finally {
            Date.now = originalNow;
        }
    });
});
