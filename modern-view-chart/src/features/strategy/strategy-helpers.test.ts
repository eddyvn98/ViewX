import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getStrategyDirections } from './strategy-helpers';
import type { Strategy, StrategyLeg } from './types';

const leg: StrategyLeg = {
    entry: { operator: 'AND', conditions: [] },
    risk: { trailing: false, lotSize: 0.1 },
};

function baseStrategy(overrides: Partial<Strategy> = {}): Strategy {
    return {
        id: 's1',
        name: 'Bot',
        active: true,
        buy: leg,
        sell: leg,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        ...overrides,
    };
}

describe('strategy direction enablement', () => {
    it('keeps legacy My Bot side=BUY from silently enabling SELL', () => {
        assert.deepEqual(getStrategyDirections(baseStrategy({ side: 'BUY' })), ['BUY']);
    });

    it('lets explicit enabledDirections override the legacy side field', () => {
        assert.deepEqual(
            getStrategyDirections(baseStrategy({ side: 'BUY', enabledDirections: ['SELL'] })),
            ['SELL'],
        );
    });

    it('preserves dual-direction legacy strategies that never had side set', () => {
        assert.deepEqual(getStrategyDirections(baseStrategy({ side: undefined })), ['BUY', 'SELL']);
    });
});
