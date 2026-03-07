import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrateStrategyStoreState } from './strategy-store';

interface MigratedState {
    matrixScanners: Array<{ strategyId: string | null; symbols: string[] }>;
}

describe('strategy-store migration', () => {
    it('migrates legacy matrixConfig into matrixScanners', () => {
        const migrated = migrateStrategyStoreState(
            {
                matrixConfig: {
                    symbols: ['XAUUSDm'],
                    timeframes: ['1m'],
                    symbolSortMode: 'added',
                    signalTtlMultiplier: 2,
                    signalTtlFloorSec: 60,
                },
            },
            1
        ) as MigratedState;

        assert.ok(Array.isArray(migrated.matrixScanners));
        assert.equal(migrated.matrixScanners.length, 1);
        assert.equal(migrated.matrixScanners[0].strategyId, null);
        assert.deepEqual(migrated.matrixScanners[0].symbols, ['XAUUSDm']);
    });
});
