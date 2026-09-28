import type { SymbolDescriptor } from '@/lib/store/types';
import {
    buildSymbolIdentityKey,
    createLegacySymbolDescriptor,
} from '@/lib/market/symbol-catalog';
import { DEFAULT_BINANCE_SYMBOLS, DEFAULT_VN_GOLD_SYMBOLS, type SourceTab } from './market-list-constants';

export interface BuildSymbolListParams {
    mode: 'discovery' | 'watchlist';
    legacyWatchlist: string[];
    watchlistItems: SymbolDescriptor[];
    availableSymbols: SymbolDescriptor[];
    tickerItems: SymbolDescriptor[];
    deferredSearch: string;
    sourceTab: SourceTab;
    binanceUniverse: string[];
    vangTodaySymbols: string[];
    prioritizeWatched: boolean;
    watchlistSearchIncludesDiscovery: boolean;
}

function matchesSourceTab(item: SymbolDescriptor, sourceTab: SourceTab): boolean {
    if (sourceTab === 'ALL') return true;
    if (sourceTab === 'MT5') return item.source === 'MT5' || item.source === 'MT5_PERSONAL';
    return item.source === sourceTab;
}

function matchesSearch(item: SymbolDescriptor, normalizedSearch: string): boolean {
    if (!normalizedSearch) return true;
    return [
        item.symbol,
        item.description,
        item.path,
        item.broker,
        item.accountLogin,
    ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
}

function addDescriptor(map: Map<string, SymbolDescriptor>, item: SymbolDescriptor | null | undefined) {
    if (!item?.symbol) return;
    map.set(buildSymbolIdentityKey(item), item);
}

export function buildSymbolList({
    mode,
    legacyWatchlist,
    watchlistItems,
    availableSymbols,
    tickerItems,
    deferredSearch,
    sourceTab,
    binanceUniverse,
    vangTodaySymbols,
    prioritizeWatched,
    watchlistSearchIncludesDiscovery,
}: BuildSymbolListParams): SymbolDescriptor[] {
    const discoveryMap = new Map<string, SymbolDescriptor>();
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    availableSymbols.forEach((item) => addDescriptor(discoveryMap, item));
    tickerItems.forEach((item) => addDescriptor(discoveryMap, item));

    DEFAULT_BINANCE_SYMBOLS.forEach((symbol) =>
        addDescriptor(discoveryMap, { symbol, source: 'BINANCE' }));
    binanceUniverse.forEach((symbol) =>
        addDescriptor(discoveryMap, { symbol, source: 'BINANCE' }));

    DEFAULT_VN_GOLD_SYMBOLS.forEach((symbol) =>
        addDescriptor(discoveryMap, { symbol, source: 'VN_GOLD' }));
    vangTodaySymbols.forEach((symbol) => {
        const normalized = String(symbol || '').trim().toUpperCase();
        if (normalized) addDescriptor(discoveryMap, { symbol: normalized, source: 'VN_GOLD' });
    });

    const migratedWatchlist = watchlistItems.length > 0
        ? watchlistItems
        : legacyWatchlist.map(createLegacySymbolDescriptor);
    const watchedKeys = new Set(migratedWatchlist.map(buildSymbolIdentityKey));

    const filterAndSort = (items: SymbolDescriptor[]) =>
        items
            .filter((item) => matchesSearch(item, normalizedSearch) && matchesSourceTab(item, sourceTab))
            .sort((a, b) => {
                if (prioritizeWatched) {
                    const aWatched = watchedKeys.has(buildSymbolIdentityKey(a));
                    const bWatched = watchedKeys.has(buildSymbolIdentityKey(b));
                    if (aWatched !== bWatched) return aWatched ? -1 : 1;
                }
                const symbolCompare = a.symbol.localeCompare(b.symbol);
                if (symbolCompare !== 0) return symbolCompare;
                return buildSymbolIdentityKey(a).localeCompare(buildSymbolIdentityKey(b));
            });

    if (mode === 'watchlist' && (!watchlistSearchIncludesDiscovery || !normalizedSearch)) {
        return filterAndSort(migratedWatchlist);
    }

    const base = mode === 'watchlist'
        ? [...migratedWatchlist, ...discoveryMap.values()]
        : Array.from(discoveryMap.values());

    const merged = new Map<string, SymbolDescriptor>();
    base.forEach((item) => addDescriptor(merged, item));

    // Manual MT5 symbol fallback is only allowed when the user explicitly selected
    // the MT5 source tab. We do not infer source from symbol suffix/text.
    if (normalizedSearch && sourceTab === 'MT5') {
        const rawSearch = deferredSearch.trim();
        if (rawSearch) {
            const candidate: SymbolDescriptor = { symbol: rawSearch, source: 'MT5' };
            const candidateKey = buildSymbolIdentityKey(candidate);
            if (!merged.has(candidateKey)) merged.set(candidateKey, candidate);
        }
    }

    return filterAndSort(Array.from(merged.values()));
}
