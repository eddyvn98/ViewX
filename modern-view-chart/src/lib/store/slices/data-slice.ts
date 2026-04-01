import { StateCreator } from 'zustand';
import { Candle } from '../types';
import { debugLog } from '@/lib/debug';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { queuePersistCandlesSnapshot } from '@/features/chart/cache/candle-cache';

export interface DataSlice {
    candleData: Record<string, Candle[]>;
    isCrosshairSyncEnabled: boolean;
    setCrosshairSync: (enabled: boolean) => void;
    syncCrosshair: (point: unknown) => void;
    setCandles: (source: string, symbol: string, interval: string, data: Candle[]) => void;
    updateLastCandle: (source: string, symbol: string, interval: string, candle: Candle) => void;
}

// Normalize time to seconds for consistent comparison (supports numeric and date-string input)
const toSeconds = (t: unknown): number => {
    const raw = typeof t === 'object' && t !== null ? (t as { timestamp?: unknown }).timestamp : t;
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
    const rawCandle = candle as unknown as Record<string, unknown>;
    const time = toSeconds(rawCandle.time);
    if (!Number.isFinite(time)) return null;

    return {
        ...(rawCandle as object),
        time,
        open: Number(rawCandle.open),
        high: Number(rawCandle.high),
        low: Number(rawCandle.low),
        close: Number(rawCandle.close),
        volume: Number(rawCandle.volume ?? 0),
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
        const current = state.candleData[key] || [];
        const normalized = (Array.isArray(data) ? data : [])
            .map(normalizeCandle)
            .filter((c): c is Candle => c !== null);
        debugLog('[DataSlice][setCandles]', { key, count: normalized.length });

        // Ignore transient empty snapshots from WS to prevent chart flicker
        // when we already have a valid candle buffer for this key.
        if (normalized.length === 0 && current.length > 0) {
            debugLog('[DataSlice][setCandles][skip-empty]', { key, prevCount: current.length });
            return state;
        }

        // Merge incoming history with current buffer so left-side backfill can extend
        // the chart instead of replacing what is already rendered.
        const mergedByTime = new Map<number, Candle>();
        current.forEach((candle) => {
            const t = toSeconds(candle.time);
            if (Number.isFinite(t)) mergedByTime.set(t, candle);
        });
        normalized.forEach((candle) => {
            const t = toSeconds(candle.time);
            if (Number.isFinite(t)) mergedByTime.set(t, candle);
        });

        const merged = Array.from(mergedByTime.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, candle]) => candle);

        const MAX_CANDLES = 5000;
        const nextCandles = merged.length > MAX_CANDLES ? merged.slice(merged.length - MAX_CANDLES) : merged;
        queuePersistCandlesSnapshot(key, nextCandles);

        return {
            candleData: { ...state.candleData, [key]: nextCandles }
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
            queuePersistCandlesSnapshot(key, newCandles);
            return { candleData: { ...state.candleData, [key]: newCandles } };
        }

        const MAX_CANDLES = 2000;
        const newCandles = currentCandles.length >= MAX_CANDLES
            ? [...currentCandles.slice(1), normalizedCandle]
            : [...currentCandles, normalizedCandle];
        queuePersistCandlesSnapshot(key, newCandles);

        return { candleData: { ...state.candleData, [key]: newCandles } };
    }),
});
