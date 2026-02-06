import { StateCreator } from 'zustand';
import { Candle } from '../types';

export interface DataSlice {
    candleData: Record<string, Candle[]>;
    isCrosshairSyncEnabled: boolean;
    crosshairPoint: {
        time: number | null,
        price: number | null,
        sourceId: string | null,
        point?: { x: number, y: number } | null,
        logical?: number | null
    } | null;
    setCrosshairSync: (enabled: boolean) => void;
    syncCrosshair: (point: DataSlice['crosshairPoint']) => void;
    setCandles: (source: string, symbol: string, interval: string, data: Candle[]) => void;
    updateLastCandle: (source: string, symbol: string, interval: string, candle: Candle) => void;
}

const normalizeSymbol = (s: string) => s.toLowerCase().endsWith('m') ? s.replace(/[mM]$/, 'm') : s;

export const createDataSlice: StateCreator<DataSlice> = (set) => ({
    candleData: {},
    isCrosshairSyncEnabled: true,
    crosshairPoint: null,

    setCrosshairSync: (enabled) => set({ isCrosshairSyncEnabled: enabled }),
    syncCrosshair: (point) => set({ crosshairPoint: point }),

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

        if (last && last.time === candle.time) {
            const newCandles = [...currentCandles];
            newCandles[newCandles.length - 1] = candle;
            return { candleData: { ...state.candleData, [key]: newCandles } };
        } else {
            return { candleData: { ...state.candleData, [key]: [...currentCandles, candle] } };
        }
    }),
});
