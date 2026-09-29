import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleEngine } from './RuleEngine';
import type { Candle } from '@/lib/store/types';
import type { Strategy, VirtualPosition } from '../types';

const candles: Candle[] = [
    { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100, volume: 10 },
    { time: 1_700_000_060, open: 100, high: 102, low: 99, close: 101, volume: 10 },
];

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
    return {
        id: 's1',
        name: 'Test',
        side: 'BUY',
        active: true,
        entry: {
            operator: 'AND',
            conditions: [{ id: 'entry', left: { type: 'Price', params: [] }, comparator: '>', right: 100 }],
        },
        risk: { trailing: false, lotSize: 0.1, cooldownMinutes: 5 },
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        ...overrides,
    };
}

describe('RuleEngine strategy consistency', () => {
    it('treats an empty Entry Setup as optional', () => {
        const strategy = makeStrategy({
            trigger: { operator: 'AND', conditions: [] },
        });
        assert.equal(RuleEngine.isEntryReady(strategy, 'BUY', candles), true);
    });

    it('requires a configured Entry Setup to pass', () => {
        const strategy = makeStrategy({
            trigger: {
                operator: 'AND',
                conditions: [{ id: 'trigger', left: { type: 'Price', params: [] }, comparator: '<', right: 0 }],
            },
        });
        assert.equal(RuleEngine.isEntryReady(strategy, 'BUY', candles), false);
    });

    it('normalizes second-based lastSignalTime for cooldown checks', () => {
        const originalNow = Date.now;
        const nowMs = 1_700_000_120_000;
        Date.now = () => nowMs;
        try {
            const strategy = makeStrategy();
            const signal = RuleEngine.run(strategy, candles, {
                activePositions: [],
                currentPrice: 101,
                symbol: 'XAUUSDm',
                lastSignalTime: Math.floor((nowMs - 60_000) / 1000),
            });
            assert.equal(signal, null);
        } finally {
            Date.now = originalNow;
        }
    });

    it('does not emit SELL when SELL is disabled even if SELL conditions are ready', () => {
        const readyLeg = {
            entry: { operator: 'AND' as const, conditions: [{ id: 'ready', left: { type: 'Price', params: [] }, comparator: '>' as const, right: 100 }] },
            trigger: { operator: 'AND' as const, conditions: [] },
            risk: { trailing: false, lotSize: 0.1 },
            entryType: 'market' as const,
        };
        const blockedLeg = {
            ...readyLeg,
            entry: { operator: 'AND' as const, conditions: [{ id: 'blocked', left: { type: 'Price', params: [] }, comparator: '<' as const, right: 0 }] },
        };
        const strategy = makeStrategy({
            side: 'BUY',
            buy: blockedLeg,
            sell: readyLeg,
            enabledDirections: ['BUY'],
        });

        const signal = RuleEngine.run(strategy, candles, {
            activePositions: [],
            currentPrice: 101,
            symbol: 'XAUUSDm',
        });

        assert.equal(signal, null);
    });

    it('emits SELL when explicit direction enablement selects SELL only', () => {
        const readyLeg = {
            entry: { operator: 'AND' as const, conditions: [{ id: 'ready', left: { type: 'Price', params: [] }, comparator: '>' as const, right: 100 }] },
            trigger: { operator: 'AND' as const, conditions: [] },
            risk: { trailing: false, lotSize: 0.1 },
            entryType: 'market' as const,
        };
        const strategy = makeStrategy({
            side: 'BUY',
            buy: readyLeg,
            sell: readyLeg,
            enabledDirections: ['SELL'],
        });

        const signal = RuleEngine.run(strategy, candles, {
            activePositions: [],
            currentPrice: 101,
            symbol: 'XAUUSDm',
        });

        assert.equal(signal?.type, 'SELL');
    });

    it('uses per-direction scale-in mode instead of the top-level BUY fallback', () => {
        const strategy = makeStrategy({
            positionMode: 'single_position',
            buy: {
                entry: {
                    operator: 'AND',
                    conditions: [{ id: 'entry', left: { type: 'Price', params: [] }, comparator: '>', right: 100 }],
                },
                trigger: { operator: 'AND', conditions: [] },
                risk: { trailing: false, lotSize: 0.1, maxTrades: 2 },
                positionMode: 'scale_in',
                entryType: 'market',
            },
        });
        const activePositions: VirtualPosition[] = [{
            id: 'p1',
            strategyId: 's1',
            symbol: 'XAUUSDm',
            timeframe: '1m',
            type: 'BUY',
            entryPrice: 100,
            sl: 0,
            tp: 0,
            lotSize: 0.1,
            timestamp: 1,
            status: 'open',
        }];

        const signal = RuleEngine.run(strategy, candles, {
            activePositions,
            currentPrice: 101,
            symbol: 'XAUUSDm',
        });
        assert.equal(signal?.type, 'BUY');
    });
});
