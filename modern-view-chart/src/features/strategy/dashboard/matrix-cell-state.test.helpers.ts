import type { Strategy } from '../types';
import type { Candle } from '@/lib/store/types';

export const baseStrategy: Strategy = {
    id: 's1',
    name: 'S1',
    side: 'BUY',
    entry: { operator: 'AND', conditions: [] },
    risk: { trailing: false, lotSize: 0.1 },
    active: true,
    positionMode: 'single_position',
    executionMode: 'virtual',
    entryType: 'market',
    symbol: 'XAUUSDm',
    timeframe: '1m',
};

export const cfg = { signalTtlMultiplier: 2, signalTtlFloorSec: 60 };

export function makeCandles(count: number, closeStart = 100): Candle[] {
    const nowSec = Math.floor(Date.now() / 1000);
    return Array.from({ length: count }, (_, i) => {
        const close = closeStart + i;
        return {
            time: nowSec - (count - i) * 60,
            open: close - 0.5,
            high: close + 1,
            low: close - 1,
            close,
            volume: 100,
        };
    });
}
