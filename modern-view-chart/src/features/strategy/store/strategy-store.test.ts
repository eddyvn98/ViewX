import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from 'zustand/vanilla';
import { createStrategyStoreState } from './strategy-store.actions';
import { migrateStrategyStoreState } from './strategy-store';

interface MigratedState {
    strategies?: Array<{ id: string; name: string; buy?: object; sell?: object }>;
    matrixScanners: Array<{ strategyId: string | null; symbols: string[] }>;
    virtualPositions?: Array<{ timeframe?: string; matrixScopeKey?: string }>;
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

    it('hydrates persisted virtualPositions with timeframe scope metadata', () => {
        const migrated = migrateStrategyStoreState(
            {
                matrixScanners: [],
                virtualPositions: [
                    {
                        id: 'p1',
                        strategyId: 's1',
                        symbol: 'BTCUSDm',
                        timeframe: '5',
                        type: 'BUY',
                        entryPrice: 1,
                        sl: 0,
                        tp: 0,
                        lotSize: 0.1,
                        timestamp: 1,
                        status: 'open',
                    },
                ],
            },
            2
        ) as MigratedState;

        assert.equal(migrated.virtualPositions?.[0]?.timeframe, '5m');
        assert.equal(migrated.virtualPositions?.[0]?.matrixScopeKey, 's1:BTCUSDm:5m');
    });

    it('merges legacy hull buy/sell bots into a single dual-direction strategy', () => {
        const migrated = migrateStrategyStoreState(
            {
                strategies: [
                    {
                        id: 'hull-ha-gold-buy',
                        name: 'Hull HA Gold Scalper (BUY)',
                        side: 'BUY',
                        active: true,
                        positionMode: 'single_position',
                        executionMode: 'virtual',
                        entryType: 'stop',
                        risk: { trailing: true, lotSize: 0.1 },
                        entry: { operator: 'AND', conditions: [] },
                    },
                    {
                        id: 'hull-ha-gold-sell',
                        name: 'Hull HA Gold Scalper (SELL)',
                        side: 'SELL',
                        active: true,
                        positionMode: 'single_position',
                        executionMode: 'virtual',
                        entryType: 'stop',
                        risk: { trailing: true, lotSize: 0.1 },
                        entry: { operator: 'AND', conditions: [] },
                    },
                ],
                matrixScanners: [
                    {
                        id: 'scanner-1',
                        name: 'Hull Scanner',
                        strategyId: 'hull-ha-gold-buy',
                        active: true,
                        symbols: ['XAUUSDm'],
                        timeframes: ['1m'],
                        symbolSortMode: 'added',
                        signalTtlMultiplier: 2,
                        signalTtlFloorSec: 60,
                    },
                ],
                signals: [
                    {
                        type: 'BUY',
                        symbol: 'XAUUSDm',
                        strategyId: 'hull-ha-gold-buy',
                        timestamp: 1,
                        price: 1,
                        risk: { trailing: true, lotSize: 0.1 },
                    },
                ],
                virtualPositions: [
                    {
                        id: 'p1',
                        strategyId: 'hull-ha-gold-sell',
                        symbol: 'XAUUSDm',
                        timeframe: '1m',
                        type: 'SELL',
                        entryPrice: 1,
                        sl: 0,
                        tp: 0,
                        lotSize: 0.1,
                        timestamp: 1,
                        status: 'open',
                    },
                ],
            },
            3
        ) as MigratedState;

        assert.equal(migrated.strategies?.some((s) => s.id === 'hull-ha-gold-buy'), false);
        assert.equal(migrated.strategies?.some((s) => s.id === 'hull-ha-gold-sell'), false);
        const merged = migrated.strategies?.find((s) => s.id === 'hull-ha-gold-scalper');
        assert.ok(merged);
        assert.ok(merged?.buy);
        assert.ok(merged?.sell);
        assert.equal(migrated.matrixScanners[0].strategyId, 'hull-ha-gold-scalper');
    });
});

describe('strategy-store actions', () => {
    it('starts with default strategies and scanners', () => {
        const store = createStore(createStrategyStoreState);
        const state = store.getState();

        assert.equal(state.strategies.length >= 2, true);
        assert.equal(state.matrixScanners.length, 1);
        assert.equal(state.matrixScanners[0].strategyId, null);
    });

    it('deleteStrategy clears scanner strategy binding and deactivates scanner', () => {
        const store = createStore(createStrategyStoreState);
        const scannerId = store.getState().addMatrixScannerForStrategy('test-trigger-rsi');

        store.getState().toggleMatrixScanner(scannerId);
        store.getState().deleteStrategy('test-trigger-rsi');

        const scanner = store.getState().matrixScanners.find((item) => item.id === scannerId);
        assert.ok(scanner);
        assert.equal(scanner?.strategyId, null);
        assert.equal(scanner?.active, false);
    });

    it('addMatrixScannerForStrategy focuses the newly created scanner', () => {
        const store = createStore(createStrategyStoreState);

        const scannerId = store.getState().addMatrixScannerForStrategy('test-trigger-rsi');
        const scanner = store.getState().matrixScanners.find((item) => item.id === scannerId);

        assert.ok(scanner);
        assert.equal(scanner?.strategyId, 'test-trigger-rsi');
        assert.equal(store.getState().focusedMatrixScannerId, scannerId);
    });

    it('toggleMatrixScanner does not activate a scanner without strategyId', () => {
        const store = createStore(createStrategyStoreState);
        const scannerId = store.getState().matrixScanners[0].id;

        store.getState().toggleMatrixScanner(scannerId);

        assert.equal(store.getState().matrixScanners[0].active, false);
    });
});
