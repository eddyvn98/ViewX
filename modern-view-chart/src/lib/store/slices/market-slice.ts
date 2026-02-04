import { StateCreator } from 'zustand';
import { SymbolInfo, Ticker } from '../types';

export interface MarketSlice {
    isConnected: boolean;
    isBridgeOnline: boolean;
    tickers: Record<string, Ticker>;
    symbolInfo: Record<string, SymbolInfo>; // Cache for symbol specs
    watchlist: string[];
    setConnected: (status: boolean) => void;
    setBridgeOnline: (status: boolean) => void;
    updateTicker: (symbol: string, data: Partial<Ticker>) => void;
    updateTickers: (data: Record<string, Partial<Ticker>>) => void;
    setSymbolInfo: (data: SymbolInfo) => void;
    addToWatchlist: (symbol: string) => void;
    removeFromWatchlist: (symbol: string) => void;
}

export const createMarketSlice: StateCreator<MarketSlice> = (set) => ({
    isConnected: false,
    isBridgeOnline: false,
    tickers: {},
    symbolInfo: {},
    watchlist: ['BTCUSDm', 'XAUUSDm', 'EURUSDm'],

    setConnected: (status) => set({ isConnected: status }),
    setBridgeOnline: (status) => set({ isBridgeOnline: status }),

    updateTicker: (symbol, data) => set((state) => ({
        tickers: {
            ...state.tickers,
            [symbol]: { ...state.tickers[symbol], ...data } as Ticker
        }
    })),

    updateTickers: (data) => set((state) => {
        const newTickers = { ...state.tickers };
        Object.keys(data).forEach(symbol => {
            newTickers[symbol] = { ...newTickers[symbol], ...data[symbol] } as Ticker;
        });
        return { tickers: newTickers };
    }),

    setSymbolInfo: (data) => set((state) => ({
        symbolInfo: {
            ...state.symbolInfo,
            [data.symbol]: data
        }
    })),

    addToWatchlist: (symbol) => set((state) => {
        if (state.watchlist.includes(symbol)) return state;
        return { watchlist: [...state.watchlist, symbol] };
    }),

    removeFromWatchlist: (symbol) => set((state) => ({
        watchlist: state.watchlist.filter(s => s !== symbol)
    })),
});
