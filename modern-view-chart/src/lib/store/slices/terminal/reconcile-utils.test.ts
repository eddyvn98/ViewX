import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    applyPendingOrderLocks,
    applyPendingPositionLocks,
    filterPendingDeletions,
    hasPositionStructuralChange,
    patchRealtimePositionFields
} from './reconcile-utils';
import type { Order, Position } from '../../types';

const FIXED_NOW_MS = 1700000000000;

function makePosition(overrides: Partial<Position> = {}): Position {
    return {
        ticket: 1,
        symbol: 'EURUSD',
        type: 'buy',
        volume: 1,
        open_price: 1.1,
        current_price: 1.101,
        sl: 1.09,
        tp: 1.12,
        profit: 10,
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
        current_price: 1.101,
        sl: 1.09,
        tp: 1.12,
        time: 1699999999,
        magic: 0,
        ...overrides
    };
}

describe('filterPendingDeletions', () => {
    it('removes items still within deletion TTL and keeps expired ones', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;

        try {
            const items = [{ ticket: 1 }, { ticket: 2 }, { ticket: 3 }];
            const pendingDeletions = {
                'MT5:1': FIXED_NOW_MS - 1000,
                'MT5:2': FIXED_NOW_MS - 15000
            };

            const filtered = filterPendingDeletions(items, pendingDeletions, 10000);
            assert.deepEqual(filtered, [{ ticket: 2 }, { ticket: 3 }]);
        } finally {
            Date.now = originalNow;
        }
    });
});

describe('applyPendingPositionLocks', () => {
    it('overrides websocket values with pending modification while lock is active', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;

        try {
            const position = makePosition({ ticket: 99, sl: 1.08, tp: 1.13, open_price: 1.2 });
            const locked = applyPendingPositionLocks(position, {
                'MT5:99-sl': { price: 1.09, timestamp: FIXED_NOW_MS - 500 },
                'MT5:99-tp': { price: 1.14, timestamp: FIXED_NOW_MS - 500 },
                'MT5:99-open_price': { price: 1.21, timestamp: FIXED_NOW_MS - 500 }
            }, 3000);

            assert.equal(locked.sl, 1.09);
            assert.equal(locked.tp, 1.14);
            assert.equal(locked.open_price, 1.21);
        } finally {
            Date.now = originalNow;
        }
    });
});

describe('applyPendingOrderLocks', () => {
    it('does not apply expired pending lock', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;

        try {
            const order = makeOrder({ ticket: 77, sl: 1.08 });
            const next = applyPendingOrderLocks(order, {
                'MT5:77-sl': { price: 1.09, timestamp: FIXED_NOW_MS - 5000 }
            }, 3000);

            assert.equal(next.sl, 1.08);
        } finally {
            Date.now = originalNow;
        }
    });
});

describe('position reconcile helpers', () => {
    it('detects structural changes only on structural fields', () => {
        const previous = makePosition();
        const realtimeOnly = makePosition({ profit: 20, current_price: 1.102 });
        const structural = makePosition({ sl: 1.08 });

        assert.equal(hasPositionStructuralChange(previous, realtimeOnly), false);
        assert.equal(hasPositionStructuralChange(previous, structural), true);
    });

    it('patches realtime fields in-place and reports change flag', () => {
        const previous = makePosition({ profit: 10, current_price: 1.101 });
        const next = makePosition({ profit: 20, current_price: 1.102 });

        const changed = patchRealtimePositionFields(previous, next);
        assert.equal(changed, true);
        assert.equal(previous.profit, 20);
        assert.equal(previous.current_price, 1.102);

        const unchanged = patchRealtimePositionFields(previous, previous);
        assert.equal(unchanged, false);
    });
});


describe('account-scoped reconcile isolation', () => {
    it('does not hide the same ticket on another MT5 account', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;
        try {
            const items = [
                { ticket: 42, source: 'MT5_PERSONAL@10001@terminal-a' },
                { ticket: 42, source: 'MT5_PERSONAL@10002@terminal-b' },
            ];
            const filtered = filterPendingDeletions(items, {
                'MT5_PERSONAL@10001@terminal-a:42': FIXED_NOW_MS - 100,
            }, 10000);

            assert.deepEqual(filtered, [
                { ticket: 42, source: 'MT5_PERSONAL@10002@terminal-b' },
            ]);
        } finally {
            Date.now = originalNow;
        }
    });

    it('applies pending SL only to the matching MT5 source', () => {
        const originalNow = Date.now;
        Date.now = () => FIXED_NOW_MS;
        try {
            const locks = {
                'MT5_PERSONAL@10001@terminal-a:99-sl': {
                    price: 1.09,
                    timestamp: FIXED_NOW_MS - 100,
                },
            };
            const accountA = applyPendingPositionLocks(
                makePosition({ ticket: 99, source: 'MT5_PERSONAL@10001@terminal-a', sl: 1.08 }),
                locks,
                3000,
            );
            const accountB = applyPendingPositionLocks(
                makePosition({ ticket: 99, source: 'MT5_PERSONAL@10002@terminal-b', sl: 1.07 }),
                locks,
                3000,
            );

            assert.equal(accountA.sl, 1.09);
            assert.equal(accountB.sl, 1.07);
        } finally {
            Date.now = originalNow;
        }
    });
});
