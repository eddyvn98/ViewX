import { StateCreator } from 'zustand';
import { SymbolInfo, Ticker } from '../types';
import { isSameSymbol, normalizeSymbol } from '@/lib/utils/symbol';

export interface MarketSlice {
    isConnected: boolean;
    isBridgeOnline: boolean;
    tickers: Record<string, Ticker>;
    symbolInfo: Record<string, SymbolInfo>; // Cache for symbol specs
    availableSymbols: Array<Record<string, unknown>>;
    watchlist: string[];
    setConnected: (status: boolean) => void;
    setBridgeOnline: (status: boolean) => void;
    updateTicker: (symbol: string, data: Partial<Ticker>) => void;
    updateTickers: (data: Record<string, Partial<Ticker>>) => void;
    setSymbolInfo: (data: SymbolInfo) => void;
    setAvailableSymbols: (symbols: Array<Record<string, unknown>>) => void;
    addToWatchlist: (symbol: string) => void;
    removeFromWatchlist: (symbol: string) => void;
}

export const createMarketSlice: StateCreator<MarketSlice> = (set) => ({
    isConnected: false,
    isBridgeOnline: false,
    tickers: {},
    symbolInfo: {},
    availableSymbols: [],
    watchlist: ['XAUUSDm', 'BTCUSDm', 'EURUSDm'],

    setConnected: (status) => set({ isConnected: status }),
    setBridgeOnline: (status) => set({ isBridgeOnline: status }),

    updateTicker: (symbol, data) => set((state) => {
        // Chỉ cập nhật nếu thực sự có giá thay đổi để tránh re-render ảo
        if (state.tickers[symbol]?.price === data.price) {
            return state;
        }
        return {
            tickers: {
                ...state.tickers,
                [symbol]: { ...state.tickers[symbol], ...data } as Ticker
            }
        };
    }),

    updateTickers: (data) => set((state) => {
        const newTickers = { ...state.tickers };
        let hasChange = false;

        Object.keys(data).forEach(symbol => {
            const current = state.tickers[symbol];
            const incoming = data[symbol];

            if (current?.price !== incoming.price) {
                newTickers[symbol] = { ...current, ...incoming } as Ticker;
                hasChange = true;
            }
        });

        return hasChange ? { tickers: newTickers } : state;
    }),

    setSymbolInfo: (data) => set((state) => ({
        symbolInfo: {
            ...state.symbolInfo,
            [data.symbol]: data
        }
    })),
    setAvailableSymbols: (symbols) => set({ availableSymbols: symbols }),

    addToWatchlist: (symbol) => set((state) => {
        const normalized = normalizeSymbol(symbol);
        if (!normalized) return state;
        if (state.watchlist.some((s) => isSameSymbol(s, normalized))) return state;
        return { watchlist: [...state.watchlist, normalized] };
    }),

    removeFromWatchlist: (symbol) => set((state) => {
        const normalized = normalizeSymbol(symbol);
        if (!normalized) return state;
        return {
            watchlist: state.watchlist.filter((s) => !isSameSymbol(s, normalized))
        };
    }),
});
