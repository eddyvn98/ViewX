import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from 'zustand/vanilla';
import { createStrategyStoreState } from './strategy-store.actions';
import { migrateStrategyStoreState } from './strategy-store';

interface MigratedState {
    strategies?: Array<{ id: string; name: string; buy?: object; sell?: object }>;
    matrixScanners: Array<{ strategyId: string | null; symbols: string[] }>;
    virtualPositions?: Array<{ id: string; timeframe?: string; matrixScopeKey?: string }>;
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

    it('rewrites duplicate virtual position ids during migration', () => {
        const migrated = migrateStrategyStoreState(
            {
                matrixScanners: [{ id: 'scanner-1', name: 'Default', strategyId: null, active: false, symbols: ['BTCUSDm'], timeframes: ['1m'] }],
                virtualPositions: [
                    {
                        id: 'bt-dup',
                        strategyId: 's1',
                        symbol: 'BTCUSDm',
                        timeframe: '1m',
                        type: 'BUY',
                        entryPrice: 1,
                        sl: 0,
                        tp: 0,
                        lotSize: 0.1,
                        timestamp: 1,
                        status: 'open',
                    },
                    {
                        id: 'bt-dup',
                        strategyId: 's1',
                        symbol: 'BTCUSDm',
                        timeframe: '1m',
                        type: 'SELL',
                        entryPrice: 1,
                        sl: 0,
                        tp: 0,
                        lotSize: 0.1,
                        timestamp: 2,
                        status: 'open',
                    },
                ],
            },
            4
        ) as MigratedState;

        assert.equal(migrated.virtualPositions?.length, 2);
        assert.notEqual(migrated.virtualPositions?.[0]?.id, migrated.virtualPositions?.[1]?.id);
    });

    it('drops duplicated active virtual positions during migration', () => {
        const migrated = migrateStrategyStoreState(
            {
                matrixScanners: [{ id: 'scanner-1', name: 'Default', strategyId: 's1', active: true, symbols: ['XAUUSDm'], timeframes: ['5m'] }],
                virtualPositions: [
                    {
                        id: 'v-1',
                        strategyId: 's1',
                        symbol: 'XAUUSDm',
                        timeframe: '5m',
                        matrixScopeKey: 's1:XAUUSDm:5m',
                        openedBarTime: 111,
                        type: 'BUY',
                        entryPrice: 5172.08,
                        sl: 5171.59,
                        tp: 0,
                        lotSize: 0.1,
                        timestamp: 1,
                        status: 'open',
                    },
                    {
                        id: 'v-2',
                        strategyId: 's1',
                        symbol: 'XAUUSDm',
                        timeframe: '5m',
                        matrixScopeKey: 's1:XAUUSDm:5m',
                        openedBarTime: 111,
                        type: 'BUY',
                        entryPrice: 5172.08,
                        sl: 5171.59,
                        tp: 0,
                        lotSize: 0.1,
                        timestamp: 2,
                        status: 'open',
                    },
                ],
            },
            5
        ) as MigratedState;

        assert.equal(migrated.virtualPositions?.length, 1);
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

    it('addVirtualPosition ignores duplicate active positions for the same bar scope', () => {
        const store = createStore(createStrategyStoreState);
        const position = {
            id: 'v-1',
            strategyId: 's1',
            symbol: 'XAUUSDm',
            timeframe: '5m',
            matrixScopeKey: 's1:XAUUSDm:5m',
            openedBarTime: 111,
            type: 'BUY' as const,
            entryPrice: 5172.08,
            sl: 5171.59,
            tp: 0,
            lotSize: 0.1,
            timestamp: 1,
            status: 'open' as const,
        };

        store.getState().addVirtualPosition(position);
        store.getState().addVirtualPosition({ ...position, id: 'v-2', timestamp: 2 });

        assert.equal(store.getState().virtualPositions.length, 1);
    });
});
