import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStrategyForSave } from './strategy-builder-model';
import type { Strategy, StrategyLeg } from '../types';

function leg(): StrategyLeg {
    return {
        entry: { operator: 'AND', conditions: [{ id: 'entry', left: { type: 'Price', params: [] }, comparator: '>', right: 0 }] },
        trigger: { operator: 'AND', conditions: [] },
        risk: { trailing: false, lotSize: 0.1 },
        entryType: 'market',
        positionMode: 'single_position',
    };
}

function existing(active: boolean): Strategy {
    return {
        id: 'existing',
        name: 'Existing',
        active,
        side: 'BUY',
        entry: leg().entry,
        risk: leg().risk,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        symbol: 'EURUSD',
        timeframe: '15m',
    };
}

describe('strategy builder save model', () => {
    it('preserves PAUSED when an existing bot is edited and saved', () => {
        const strategy = buildStrategyForSave({
            editingStrategy: existing(false),
            name: 'Edited',
            buy: leg(),
            sell: leg(),
            buyEnabled: true,
            sellEnabled: false,
            executionMode: 'virtual',
            magic: 123,
            comment: 'test',
        });

        assert.equal(strategy.active, false);
        assert.deepEqual(strategy.enabledDirections, ['BUY']);
        assert.equal(strategy.symbol, 'EURUSD');
        assert.equal(strategy.timeframe, '15m');
    });

    it('activates a new bot and persists explicit BUY SELL enablement', () => {
        const strategy = buildStrategyForSave({
            name: 'New',
            buy: leg(),
            sell: leg(),
            buyEnabled: false,
            sellEnabled: true,
            executionMode: 'virtual',
            magic: 123,
            comment: 'test',
            activeChart: { symbol: 'XAUUSDm', interval: '5m' },
            idFactory: () => 'new-id',
        });

        assert.equal(strategy.id, 'new-id');
        assert.equal(strategy.active, true);
        assert.equal(strategy.side, 'SELL');
        assert.deepEqual(strategy.enabledDirections, ['SELL']);
    });
});
