import type { MatrixScannerConfig, MatrixSortMode, StrategyMatrixConfig } from '../dashboard/matrix-types';
import type { Strategy } from '../types';

export const DEFAULT_SCANNER_BASE = {
    symbols: ['XAUUSDm', 'BTCUSDm', 'EURUSDm'],
    timeframes: ['1m', '5m', '15m', '1h', '4h'],
    symbolSortMode: 'added' as MatrixSortMode,
    signalTtlMultiplier: 2,
    signalTtlFloorSec: 60,
};

export const LEGACY_DEFAULT_MATRIX_CONFIG: StrategyMatrixConfig = { ...DEFAULT_SCANNER_BASE };
export const MERGED_HULL_STRATEGY_ID = 'hull-ha-gold-scalper';

export function createMergedHullStrategy(): Strategy {
    return {
        id: MERGED_HULL_STRATEGY_ID,
        name: 'Hull HA Gold Scalper',
        active: true,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'stop',
        magic: 123456,
        comment: 'WebHA',
        lockMatrixScopeWhileOpen: true,
        buy: {
            entry: {
                operator: 'AND',
                conditions: [{ id: 'buy-rsi-60', left: { type: 'RSI', params: [14] }, comparator: '>', right: 60 }],
            },
            exit: {
                operator: 'OR',
                conditions: [{ id: 'buy-rsi-exit', left: { type: 'RSI', params: [14] }, comparator: '<', right: 55 }],
            },
            cancelConditions: {
                operator: 'OR',
                conditions: [{ id: 'buy-cancel-rsi', left: { type: 'RSI', params: [14] }, comparator: '<', right: 55 }],
            },
            risk: {
                sl: { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 },
                tp: undefined,
                trailing: true,
                slSource: 'HA_Low',
                trailingSource: 'HA_Low',
                lotSize: 0.1,
            },
            entryType: 'stop',
            lockMatrixScopeWhileOpen: true,
        },
        sell: {
            entry: {
                operator: 'AND',
                conditions: [{ id: 'sell-rsi-40', left: { type: 'RSI', params: [14] }, comparator: '<', right: 40 }],
            },
            exit: {
                operator: 'OR',
                conditions: [{ id: 'sell-rsi-exit', left: { type: 'RSI', params: [14] }, comparator: '>', right: 45 }],
            },
            cancelConditions: {
                operator: 'OR',
                conditions: [{ id: 'sell-cancel-rsi', left: { type: 'RSI', params: [14] }, comparator: '>', right: 45 }],
            },
            risk: {
                sl: { mode: 'candle', candleField: 'high', candleOffset: 1, offset: 0 },
                tp: undefined,
                trailing: true,
                slSource: 'HA_High',
                trailingSource: 'HA_High',
                lotSize: 0.1,
            },
            entryType: 'stop',
            lockMatrixScopeWhileOpen: true,
        },
        risk: {
            sl: { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 },
            tp: undefined,
            trailing: true,
            slSource: 'HA_Low',
            trailingSource: 'HA_Low',
            lotSize: 0.1,
        },
        entry: {
            operator: 'AND',
            conditions: [{ id: 'buy-rsi-60', left: { type: 'RSI', params: [14] }, comparator: '>', right: 60 }],
        },
        exit: {
            operator: 'OR',
            conditions: [{ id: 'buy-rsi-exit', left: { type: 'RSI', params: [14] }, comparator: '<', right: 55 }],
        },
        cancelConditions: {
            operator: 'OR',
            conditions: [{ id: 'buy-cancel-rsi', left: { type: 'RSI', params: [14] }, comparator: '<', right: 55 }],
        },
        side: undefined,
    };
}

export function createScannerFromConfig(config: StrategyMatrixConfig, strategyId: string | null = null): MatrixScannerConfig {
    return {
        id: `scanner-${Date.now()}`,
        name: 'Matrix Scanner 1',
        strategyId,
        active: false,
        symbols: [...config.symbols],
        timeframes: [...config.timeframes],
        symbolSortMode: config.symbolSortMode,
        signalTtlMultiplier: config.signalTtlMultiplier,
        signalTtlFloorSec: config.signalTtlFloorSec,
    };
}

export function createDefaultScanner(index = 0): MatrixScannerConfig {
    return {
        id: `scanner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Matrix Scanner ${index + 1}`,
        strategyId: null,
        active: false,
        symbols: [...DEFAULT_SCANNER_BASE.symbols],
        timeframes: [...DEFAULT_SCANNER_BASE.timeframes],
        symbolSortMode: DEFAULT_SCANNER_BASE.symbolSortMode,
        signalTtlMultiplier: DEFAULT_SCANNER_BASE.signalTtlMultiplier,
        signalTtlFloorSec: DEFAULT_SCANNER_BASE.signalTtlFloorSec,
    };
}

export const initialStrategies: Strategy[] = [
    createMergedHullStrategy(),
    {
        id: 'test-trigger-rsi',
        name: 'Test Fast Trigger (RSI > 20)',
        side: 'BUY',
        active: false,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        magic: 999999,
        comment: 'TestTrigger',
        entry: {
            operator: 'AND',
            conditions: [{ id: 'rsi-gt-20', left: { type: 'RSI', params: [14] }, comparator: '>', right: 20 }],
        },
        risk: {
            sl: 100,
            tp: 200,
            trailing: false,
            lotSize: 0.01,
            cooldownMinutes: 1,
        },
    },
];
