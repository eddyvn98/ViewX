import { DEFAULT_BINANCE_SYMBOLS, type DataSource, type SourceTab } from './market-list-constants';
import { resolveDataSource } from './market-list-utils';

export interface BuildSymbolListParams {
    mode: 'discovery' | 'watchlist';
    watchlist: string[];
    availableSymbols: Array<{ symbol?: string | undefined } | string>;
    allSymbols: string[];
    deferredSearch: string;
    sourceTab: SourceTab;
    binanceUniverse: string[];
    prioritizeWatched: boolean;
    watchlistSearchIncludesDiscovery: boolean;
}

export interface SymbolDisplayMeta {
    canonicalSymbol?: string;
    rawSymbol?: string;
    accountLogin?: string;
    server?: string;
    terminalId?: string;
}

export interface SymbolListItem {
    symbol: string;
    source: DataSource;
    meta?: SymbolDisplayMeta;
}

export function buildSymbolList({
    mode,
    watchlist,
    availableSymbols,
    allSymbols,
    deferredSearch,
    sourceTab,
    binanceUniverse,
    prioritizeWatched,
    watchlistSearchIncludesDiscovery,
}: BuildSymbolListParams): SymbolListItem[] {
    const discoveryMap = new Map<string, DataSource>();
    const metaMap = new Map<string, SymbolDisplayMeta>();
    const normalizedSearch = deferredSearch.toLowerCase();

    availableSymbols.forEach((s) => {
        const item = typeof s === 'string' ? { symbol: s } : s;
        const raw = typeof s === 'string'
            ? s
            : s?.symbol || (s as { canonicalSymbol?: string }).canonicalSymbol;
        const symbol = String(raw || '').trim();
        if (!symbol) return;
        discoveryMap.set(symbol, resolveDataSource(symbol));
        if (item && typeof item === 'object') {
            metaMap.set(symbol, {
                canonicalSymbol: String((item as { canonicalSymbol?: string }).canonicalSymbol || '').trim() || undefined,
                rawSymbol: String((item as { rawSymbol?: string }).rawSymbol || '').trim() || undefined,
                accountLogin: String((item as { accountLogin?: string }).accountLogin || '').trim() || undefined,
                server: String((item as { server?: string }).server || '').trim() || undefined,
                terminalId: String((item as { terminalId?: string }).terminalId || '').trim() || undefined,
            });
        }
    });

    // Keep discovery mode stable: do not continuously blend in runtime ticker symbols.
    // Runtime ticker set is only merged for watchlist-oriented flows.
    if (mode === 'watchlist' || watchlistSearchIncludesDiscovery) {
        allSymbols.forEach((symbol) => {
            const normalized = String(symbol || '').trim();
            if (!normalized) return;
            discoveryMap.set(normalized, resolveDataSource(normalized));
        });
    }

    DEFAULT_BINANCE_SYMBOLS.forEach((symbol) => {
        if (!discoveryMap.has(symbol)) discoveryMap.set(symbol, 'BINANCE');
    });

    binanceUniverse.forEach((symbol) => {
        if (!discoveryMap.has(symbol)) discoveryMap.set(symbol, 'BINANCE');
    });

    let symbols: SymbolListItem[] = [];

    if (mode === 'watchlist') {
        symbols = watchlist.map((symbol) => ({
            symbol,
            source: discoveryMap.get(symbol) ?? resolveDataSource(symbol),
            meta: metaMap.get(symbol),
        }));
    } else {
        symbols = Array.from(discoveryMap.entries()).map(([symbol, source]) => ({
            symbol,
            source,
            meta: metaMap.get(symbol),
        }));
    }

    const filtered = symbols
        .filter((ticker) => {
            const s = ticker.symbol.toLowerCase();
            const matchesSearch = s.includes(normalizedSearch);
            const matchesTab = sourceTab === 'ALL' || ticker.source === sourceTab;
            return matchesSearch && matchesTab;
        })
        .sort((a, b) => {
            if (prioritizeWatched) {
                const aWatched = watchlist.includes(a.symbol);
                const bWatched = watchlist.includes(b.symbol);
                if (aWatched !== bWatched) return aWatched ? -1 : 1;
            }
            return a.symbol.localeCompare(b.symbol);
        });

    if (normalizedSearch) {
        const rawSearch = deferredSearch.trim().toUpperCase();
        const looksLikeForexPair = /^[A-Z]{6}M?$/.test(rawSearch);
        if (looksLikeForexPair) {
            const normalizedCandidate = rawSearch.endsWith('M') ? rawSearch : `${rawSearch}m`;
            const candidateSource = resolveDataSource(normalizedCandidate);
            const candidateMatchesTab = sourceTab === 'ALL' || sourceTab === candidateSource;
            const exists = filtered.some((item) => item.symbol === rawSearch || item.symbol === normalizedCandidate);
            if (candidateMatchesTab && !exists) {
                filtered.unshift({ symbol: normalizedCandidate, source: candidateSource });
            }
        }
    }

    if (mode === 'watchlist' && watchlistSearchIncludesDiscovery && normalizedSearch) {
        const merged = new Map<string, SymbolListItem>();
        const rawSearch = deferredSearch.trim().toUpperCase();

        watchlist.forEach((symbol) => {
            const normalized = String(symbol || '').trim();
            if (!normalized) return;
            if (normalized.toLowerCase().includes(normalizedSearch)) {
                merged.set(normalized, {
                    symbol: normalized,
                    source: discoveryMap.get(normalized) ?? resolveDataSource(normalized),
                    meta: metaMap.get(normalized),
                });
            }
        });

        Array.from(discoveryMap.entries()).forEach(([symbol, source]) => {
            if (symbol.toLowerCase().includes(normalizedSearch)) {
                merged.set(symbol, { symbol, source });
                const existing = merged.get(symbol);
                if (existing) {
                    existing.meta = existing.meta || metaMap.get(symbol);
                    merged.set(symbol, existing);
                }
            }
        });

        filtered.forEach((item) => merged.set(item.symbol, item));

        // Allow manual-typed FX symbol discovery when the upstream symbol universe is incomplete on local.
        // Example: user types USDCAD and can still add it to watchlist.
        const looksLikeForexPair = /^[A-Z]{6}M?$/.test(rawSearch);
        if (looksLikeForexPair) {
            const normalizedCandidate = rawSearch.endsWith('M') ? rawSearch : `${rawSearch}m`;
            if (!merged.has(rawSearch) && !merged.has(normalizedCandidate)) {
                const candidate = normalizedCandidate;
                const candidateSource = resolveDataSource(candidate);
                if (sourceTab === 'ALL' || sourceTab === candidateSource) {
                    merged.set(candidate, { symbol: candidate, source: candidateSource, meta: metaMap.get(candidate) });
                }
            }
        }

        return Array.from(merged.values()).sort((a, b) => {
            const aWatched = watchlist.includes(a.symbol);
            const bWatched = watchlist.includes(b.symbol);
            if (aWatched !== bWatched) return aWatched ? -1 : 1;
            return a.symbol.localeCompare(b.symbol);
        });
    }

    return filtered;
}
