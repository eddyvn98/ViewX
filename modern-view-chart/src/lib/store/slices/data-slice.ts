import { StateCreator } from 'zustand';
import { Candle } from '../types';

export interface DataSlice {
    candleData: Record<string, Candle[]>;
    isCrosshairSyncEnabled: boolean;
    setCrosshairSync: (enabled: boolean) => void;
    syncCrosshair: (point: any) => void;
    setCandles: (source: string, symbol: string, interval: string, data: Candle[]) => void;
    updateLastCandle: (source: string, symbol: string, interval: string, candle: Candle) => void;
}

import { normalizeSymbol } from '@/lib/utils/symbol';

// Normalize time to seconds for consistent comparison (handles both ms and sec formats)
const toSeconds = (t: any): number => {
    const n = typeof t === 'object' ? (t as any).timestamp : Number(t);
    return n > 10000000000 ? Math.floor(n / 1000) : n;
};

export const createDataSlice: StateCreator<DataSlice> = (set) => ({
    candleData: {},
    isCrosshairSyncEnabled: true,

    setCrosshairSync: (enabled) => set({ isCrosshairSyncEnabled: enabled }),
    syncCrosshair: () => { }, // No longer store in state to prevent global re-renders

    setCandles: (source, symbol, interval, data) => set((state) => {
        const normSymbol = normalizeSymbol(symbol);
        const key = `${source}:${normSymbol}:${interval}`;
        return {
            candleData: { ...state.candleData, [key]: data }
        };
    }),

    updateLastCandle: (source, symbol, interval, candle) => set((state) => {
        const normSymbol = normalizeSymbol(symbol);
        const key = `${source}:${normSymbol}:${interval}`;
        const currentCandles = state.candleData[key] || [];
        const last = currentCandles[currentCandles.length - 1];

        // ⚡ FIX: Compare NORMALIZED seconds to prevent append-spam from format mismatch
        if (last && toSeconds(last.time) === toSeconds(candle.time)) {
            // Cập nhật nến hiện tại: Thay thế phần tử cuối
            const newCandles = [...currentCandles];
            newCandles[newCandles.length - 1] = candle;
            return { candleData: { ...state.candleData, [key]: newCandles } };
        } else {
            // Thêm nến mới: Giới hạn tối đa 2000 nến để bảo vệ RAM
            const MAX_CANDLES = 2000;
            const newCandles = currentCandles.length >= MAX_CANDLES
                ? [...currentCandles.slice(1), candle]
                : [...currentCandles, candle];

            return { candleData: { ...state.candleData, [key]: newCandles } };
        }
    }),
});
