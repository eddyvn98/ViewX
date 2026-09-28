import { StateCreator } from 'zustand';
import { SymbolDescriptor, SymbolInfo, Ticker } from '../types';
import { isSameSymbol, normalizeSymbol } from '@/lib/utils/symbol';
import {
    buildSymbolIdentityKey,
    createLegacySymbolDescriptor,
    sameSymbolIdentity,
} from '@/lib/market/symbol-catalog';

const DEFAULT_WATCHLIST = ['XAUUSDm', 'BTCUSDm', 'EURUSDm'];

export interface MarketSlice {
    isConnected: boolean;
    isBridgeOnline: boolean;
    tickers: Record<string, Ticker>;
    symbolInfo: Record<string, SymbolInfo>;
    availableSymbols: SymbolDescriptor[];
    symbolCatalogByScope: Record<string, SymbolDescriptor[]>;
    activeSymbolCatalogScope: string;
    watchlist: string[];
    watchlistItems: SymbolDescriptor[];
    setConnected: (status: boolean) => void;
    setBridgeOnline: (status: boolean) => void;
    updateTicker: (symbol: string, data: Partial<Ticker>) => void;
    updateTickers: (data: Record<string, Partial<Ticker>>) => void;
    setSymbolInfo: (data: SymbolInfo, keyOverride?: string) => void;
    setAvailableSymbols: (symbols: SymbolDescriptor[], scopeKey?: string) => void;
    activateSymbolCatalog: (scopeKey: string) => void;
    addToWatchlist: (symbol: string) => void;
    removeFromWatchlist: (symbol: string) => void;
    addSymbolToWatchlist: (item: SymbolDescriptor) => void;
    removeSymbolFromWatchlist: (item: SymbolDescriptor) => void;
}

export const createMarketSlice: StateCreator<MarketSlice> = (set) => ({
    isConnected: false,
    isBridgeOnline: false,
    tickers: {},
    symbolInfo: {},
    availableSymbols: [],
    symbolCatalogByScope: {},
    activeSymbolCatalogScope: 'MT5',
    watchlist: DEFAULT_WATCHLIST,
    watchlistItems: DEFAULT_WATCHLIST.map(createLegacySymbolDescriptor),

    setConnected: (status) => set({ isConnected: status }),
    setBridgeOnline: (status) => set({ isBridgeOnline: status }),

    updateTicker: (symbol, data) => set((state) => {
        if (state.tickers[symbol]?.price === data.price) return state;
        return {
            tickers: {
                ...state.tickers,
                [symbol]: { ...state.tickers[symbol], ...data } as Ticker,
            },
        };
    }),

    updateTickers: (data) => set((state) => {
        const newTickers = { ...state.tickers };
        let hasChange = false;

        Object.keys(data).forEach((symbol) => {
            const current = state.tickers[symbol];
            const incoming = data[symbol];
            if (
                current?.price !== incoming.price ||
                current?.bid !== incoming.bid ||
                current?.ask !== incoming.ask ||
                current?.displayName !== incoming.displayName
            ) {
                newTickers[symbol] = { ...current, ...incoming } as Ticker;
                hasChange = true;
            }
        });

        return hasChange ? { tickers: newTickers } : state;
    }),

    setSymbolInfo: (data, keyOverride) => set((state) => {
        const key = String(keyOverride || data.symbol || '').trim();
        if (!key) return state;
        return {
            symbolInfo: {
                ...state.symbolInfo,
                [key]: data,
                [data.symbol]: data,
            },
        };
    }),

    setAvailableSymbols: (symbols, scopeKey = 'MT5') => set((state) => {
        const clean = Array.isArray(symbols)
            ? symbols.filter((item) => Boolean(item?.symbol))
            : [];
        return {
            availableSymbols: state.activeSymbolCatalogScope === scopeKey
                ? clean
                : state.availableSymbols,
            symbolCatalogByScope: {
                ...state.symbolCatalogByScope,
                [scopeKey]: clean,
            },
        };
    }),

    activateSymbolCatalog: (scopeKey) => set((state) => ({
        activeSymbolCatalogScope: scopeKey,
        availableSymbols: state.symbolCatalogByScope[scopeKey] || [],
    })),

    addToWatchlist: (symbol) => set((state) => {
        const normalized = normalizeSymbol(symbol);
        if (!normalized) return state;
        if (state.watchlist.some((s) => isSameSymbol(s, normalized))) return state;
        const descriptor = createLegacySymbolDescriptor(normalized);
        return {
            watchlist: [...state.watchlist, normalized],
            watchlistItems: [...state.watchlistItems, descriptor],
        };
    }),

    removeFromWatchlist: (symbol) => set((state) => {
        const normalized = normalizeSymbol(symbol);
        if (!normalized) return state;
        return {
            watchlist: state.watchlist.filter((s) => !isSameSymbol(s, normalized)),
            watchlistItems: state.watchlistItems.filter((item) => !isSameSymbol(item.symbol, normalized)),
        };
    }),

    addSymbolToWatchlist: (item) => set((state) => {
        if (!item?.symbol) return state;
        if (state.watchlistItems.some((current) => sameSymbolIdentity(current, item))) return state;

        const hasLegacySymbol = state.watchlist.some((symbol) => isSameSymbol(symbol, item.symbol));
        return {
            watchlistItems: [...state.watchlistItems, item],
            watchlist: hasLegacySymbol ? state.watchlist : [...state.watchlist, item.symbol],
        };
    }),

    removeSymbolFromWatchlist: (item) => set((state) => {
        const targetKey = buildSymbolIdentityKey(item);
        const nextItems = state.watchlistItems.filter((current) => buildSymbolIdentityKey(current) !== targetKey);
        const stillHasSymbol = nextItems.some((current) => isSameSymbol(current.symbol, item.symbol));
        return {
            watchlistItems: nextItems,
            watchlist: stillHasSymbol
                ? state.watchlist
                : state.watchlist.filter((symbol) => !isSameSymbol(symbol, item.symbol)),
        };
    }),
});
