import type { Strategy, VirtualPosition } from '../../types';
import type { Candle } from '@/lib/store/types';

export const FIXED_NOW_MS = 1700000000000;

export function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
    return {
        id: 's1',
        name: 'Test Strategy',
        side: 'BUY',
        entry: { operator: 'AND', conditions: [] },
        risk: { trailing: false, lotSize: 0.1, sl: 20, tp: 40 },
        active: true,
        positionMode: 'single_position',
        executionMode: 'virtual',
        entryType: 'market',
        ...overrides
    };
}

export function makeVirtualPosition(overrides: Partial<VirtualPosition> = {}): VirtualPosition {
    return {
        id: 'v1',
        strategyId: 's1',
        symbol: 'EURUSD',
        timeframe: '1m',
        matrixScopeKey: 's1:EURUSD:1m',
        openedBarTime: 123,
        type: 'BUY',
        entryPrice: 1.1,
        sl: 1.09,
        tp: 1.12,
        lotSize: 0.1,
        timestamp: FIXED_NOW_MS - 10000,
        status: 'open',
        ...overrides
    };
}

export function makeCandle(overrides: Partial<Candle> = {}): Candle {
    return {
        time: FIXED_NOW_MS,
        open: 1.1,
        high: 1.11,
        low: 1.09,
        close: 1.105,
        volume: 100,
        ...overrides
    };
}
