import { StateCreator } from 'zustand';
import { Candle } from '../types';
import { normalizeSymbol } from '@/lib/utils/symbol';

export interface DataSlice {
    candleData: Record<string, Candle[]>;
    isCrosshairSyncEnabled: boolean;
    setCrosshairSync: (enabled: boolean) => void;
    syncCrosshair: (point: any) => void;
    setCandles: (source: string, symbol: string, interval: string, data: Candle[]) => void;
    updateLastCandle: (source: string, symbol: string, interval: string, candle: Candle) => void;
}

// Normalize time to seconds for consistent comparison (supports numeric and date-string input)
const toSeconds = (t: any): number => {
    const raw = typeof t === 'object' ? (t as any)?.timestamp : t;
    const n = Number(raw);
    if (Number.isFinite(n)) {
        return n > 10000000000 ? Math.floor(n / 1000) : n;
    }

    if (typeof raw === 'string') {
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) {
            return Math.floor(parsed / 1000);
        }
    }

    return NaN;
};

const normalizeCandle = (candle: Candle): Candle | null => {
    const time = toSeconds((candle as any).time);
    if (!Number.isFinite(time)) return null;

    return {
        ...(candle as any),
        time,
        open: Number((candle as any).open),
        high: Number((candle as any).high),
        low: Number((candle as any).low),
        close: Number((candle as any).close),
        volume: Number((candle as any).volume ?? 0),
    } as Candle;
};

export const createDataSlice: StateCreator<DataSlice> = (set) => ({
    candleData: {},
    isCrosshairSyncEnabled: true,

    setCrosshairSync: (enabled) => set({ isCrosshairSyncEnabled: enabled }),
    syncCrosshair: () => { }, // Kept for compatibility; no state update to avoid global re-renders.

    setCandles: (source, symbol, interval, data) => set((state) => {
        const normSymbol = normalizeSymbol(symbol);
        const key = `${source}:${normSymbol}:${interval}`;
        const normalized = (Array.isArray(data) ? data : [])
            .map(normalizeCandle)
            .filter((c): c is Candle => c !== null);
        if (process.env.NODE_ENV !== 'production') {
            console.log('[DataSlice][setCandles]', { key, count: normalized.length });
        }

        return {
            candleData: { ...state.candleData, [key]: normalized }
        };
    }),

    updateLastCandle: (source, symbol, interval, candle) => set((state) => {
        const normSymbol = normalizeSymbol(symbol);
        const key = `${source}:${normSymbol}:${interval}`;
        const currentCandles = state.candleData[key] || [];
        const normalizedCandle = normalizeCandle(candle);
        if (!normalizedCandle) return state;

        const last = currentCandles[currentCandles.length - 1];
        // Compare normalized seconds to prevent append-spam from ms/sec mismatch.
        if (last && toSeconds(last.time) === toSeconds(normalizedCandle.time)) {
            const newCandles = [...currentCandles];
            newCandles[newCandles.length - 1] = normalizedCandle;
            return { candleData: { ...state.candleData, [key]: newCandles } };
        }

        const MAX_CANDLES = 2000;
        const newCandles = currentCandles.length >= MAX_CANDLES
            ? [...currentCandles.slice(1), normalizedCandle]
            : [...currentCandles, normalizedCandle];

        return { candleData: { ...state.candleData, [key]: newCandles } };
    }),
});
