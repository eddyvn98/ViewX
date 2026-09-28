'use client';

import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Search, PanelsTopLeft } from 'lucide-react';
import React, { useCallback, useDeferredValue, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { List } from 'react-window';

import { SOURCE_TABS, type SourceTab } from './market-list-constants';
import { useBinanceUniverse } from './use-binance-universe';
import { useVangTodaySymbols } from './use-vangtoday-symbols';
import { buildSymbolList } from './build-symbol-list';
import { RowData, VirtualRow } from './VirtualRow';
import type { SymbolDescriptor } from '@/lib/store/types';
import { buildSymbolIdentityKey, createLegacySymbolDescriptor } from '@/lib/market/symbol-catalog';

interface MarketListContentProps {
    mode: 'discovery' | 'watchlist';
    showSearchHeader?: boolean;
    showOpenDialogButton?: boolean;
    prioritizeWatched?: boolean;
    closeDialogOnSelect?: boolean;
    watchlistSearchIncludesDiscovery?: boolean;
    addToWatchlistOnSelect?: boolean;
}

export function MarketListContent({
    mode,
    showSearchHeader = true,
    showOpenDialogButton = false,
    prioritizeWatched = false,
    closeDialogOnSelect = true,
    watchlistSearchIncludesDiscovery = true,
    addToWatchlistOnSelect = true,
}: MarketListContentProps) {
    const watchlist = useMarketStore((state) => state.watchlist);
    const watchlistItems = useMarketStore((state) => state.watchlistItems);
    const addSymbolToWatchlist = useMarketStore((state) => state.addSymbolToWatchlist);
    const removeSymbolFromWatchlist = useMarketStore((state) => state.removeSymbolFromWatchlist);
    const isMarketListDialogOpen = useMarketStore((state) => state.isMarketListDialogOpen);
    const setMarketListDialogOpen = useMarketStore((state) => state.setMarketListDialogOpen);

    const tickerItems = useMarketStore(useShallow((state) => {
        const seen = new Set<string>();
        const items: SymbolDescriptor[] = [];
        Object.values(state.tickers).forEach((ticker) => {
            if (!ticker?.symbol) return;
            const source = ticker.source || createLegacySymbolDescriptor(ticker.symbol).source;
            if (source === 'MT5_PERSONAL') return;
            const item: SymbolDescriptor = { symbol: ticker.symbol, source };
            const key = buildSymbolIdentityKey(item);
            if (seen.has(key)) return;
            seen.add(key);
            items.push(item);
        });
        return items;
    }));
    const availableSymbols = useMarketStore((state) => state.availableSymbols);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore(useShallow((state) => (activeTabId ? state.tabs[activeTabId] : null)));
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const { broadcastSymbolChange, broadcastGroupSymbolChange } = useCrossWindowSync();

    const activeChartId = useMemo(() => {
        if (!activeTab) return null;
        if (activeTab.activeChartId && activeTab.charts[activeTab.activeChartId]) {
            return activeTab.activeChartId;
        }
        return Object.keys(activeTab.charts || {})[0] || null;
    }, [activeTab]);
    const charts = useMemo(() => activeTab?.charts || {}, [activeTab?.charts]);
    const activeChartKey = useMemo(() => {
        if (!activeChartId) return null;
        const chart = charts[activeChartId];
        if (!chart) return null;
        return buildSymbolIdentityKey({
            symbol: chart.symbol,
            source: chart.source,
            accountLogin: chart.accountLogin,
            terminalId: chart.terminalId,
        });
    }, [activeChartId, charts]);

    const search = useMarketStore((state) => state.marketListSearchQuery);
    const setSearch = useMarketStore((state) => state.setMarketListSearchQuery);
    const deferredSearch = useDeferredValue(search);
    const sourceTab = useMarketStore((state) => state.marketListSourceTab) as SourceTab;
    const setSourceTab = useMarketStore((state) => state.setMarketListSourceTab);

    const shouldLoadDiscoveryUniverse =
        mode === 'discovery' || (watchlistSearchIncludesDiscovery && mode === 'watchlist' && deferredSearch.trim().length > 0);
    const binanceUniverse = useBinanceUniverse(shouldLoadDiscoveryUniverse);
    const vangTodaySymbols = useVangTodaySymbols(shouldLoadDiscoveryUniverse);

    const symbolList = useMemo(
        () =>
            buildSymbolList({
                mode,
                legacyWatchlist: watchlist,
                watchlistItems,
                availableSymbols,
                tickerItems,
                deferredSearch,
                sourceTab,
                binanceUniverse,
                vangTodaySymbols,
                prioritizeWatched,
                watchlistSearchIncludesDiscovery,
            }),
        [
            mode,
            watchlist,
            watchlistItems,
            availableSymbols,
            tickerItems,
            deferredSearch,
            sourceTab,
            binanceUniverse,
            vangTodaySymbols,
            prioritizeWatched,
            watchlistSearchIncludesDiscovery,
        ],
    );

    const handledWatchlist = useMemo(
        () => new Set(watchlistItems.map(buildSymbolIdentityKey)),
        [watchlistItems],
    );

    const handleSymbolSelect = useCallback(
        (item: SymbolDescriptor) => {
            if (!activeChartId) return;
            const chart = charts[activeChartId];
            setChartSymbol(activeChartId, item.symbol, item.source, item);

            if (chart?.group && chart.group !== 'none') {
                broadcastGroupSymbolChange(chart.group, item);
            } else {
                broadcastSymbolChange(activeChartId, item);
            }

            if (addToWatchlistOnSelect) {
                addSymbolToWatchlist(item);
            }
            if (closeDialogOnSelect && isMarketListDialogOpen) {
                setMarketListDialogOpen(false);
            }
        },
        [
            activeChartId,
            charts,
            setChartSymbol,
            addSymbolToWatchlist,
            broadcastGroupSymbolChange,
            broadcastSymbolChange,
            addToWatchlistOnSelect,
            closeDialogOnSelect,
            isMarketListDialogOpen,
            setMarketListDialogOpen,
        ],
    );

    const rowData = useMemo<RowData>(
        () => ({
            items: symbolList,
            mode,
            activeChartKey,
            watchedSet: handledWatchlist,
            onSelect: handleSymbolSelect,
            onAdd: addSymbolToWatchlist,
            onRemove: removeSymbolFromWatchlist,
        }),
        [symbolList, mode, activeChartKey, handledWatchlist, handleSymbolSelect, addSymbolToWatchlist, removeSymbolFromWatchlist],
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent min-h-0 h-full">
            {showSearchHeader && (
                <div className="px-3 py-2 border-b border-border dark:border-white/[0.03] flex items-center justify-between shrink-0 bg-secondary/50 dark:bg-white/[0.02] gap-2">
                    <div className="relative flex-1 group flex items-center gap-2">
                        {showOpenDialogButton && (
                            <button
                                type="button"
                                onClick={() => setMarketListDialogOpen(true)}
                                className="h-7 w-7 shrink-0 rounded-lg border border-border dark:border-white/5 bg-secondary/50 dark:bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-background transition-all flex items-center justify-center"
                                aria-label="Open market list"
                                title="Open market list"
                            >
                                <PanelsTopLeft size={14} />
                            </button>
                        )}
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 dark:text-white/10 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder={mode === 'watchlist' ? 'Search watchlist + market...' : 'Quick search...'}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-secondary/50 dark:bg-white/[0.03] border border-border dark:border-white/5 rounded-lg pl-8 pr-3 py-1 text-[11px] text-foreground font-medium transition-all h-7 focus:bg-background outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex bg-secondary/50 dark:bg-white/[0.03] p-0.5 rounded-xl border border-border dark:border-white/5 h-7 shadow-sm">
                        {SOURCE_TABS.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSourceTab(tab)}
                                className={cn(
                                    "px-2.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center tracking-wide",
                                    sourceTab === tab
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground/60 hover:text-foreground"
                                )}
                            >
                                {tab === 'BINANCE' ? 'CRYPTO' : tab === 'MT5' ? 'FOREX' : tab === 'VN_GOLD' ? 'VN GOLD' : 'ALL'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {mode === 'watchlist' && (
                <div className="grid grid-cols-[3fr_3fr_4.5fr] items-center mx-3 px-3 py-2 bg-transparent text-[11px] text-muted-foreground font-bold uppercase tracking-wider shrink-0 gap-2 border-b border-border/5 mt-1">
                    <span className="truncate opacity-50">Symbol</span>
                    <span className="text-right opacity-50">Live price</span>
                    <span className="text-right opacity-50">Change</span>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-background/5">
                {symbolList.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-xs italic">
                        {mode === 'watchlist'
                            ? deferredSearch.trim()
                                ? 'No symbols matched your watchlist or market list search'
                                : 'Your watchlist is empty'
                            : 'No tickers found'}
                    </div>
                ) : (
                    <AutoSizer
                        renderProp={({ height, width }) => (
                            <List
                                style={{ height: height ?? 0, width: width ?? 0 }}
                                rowCount={symbolList.length}
                                rowHeight={mode === 'watchlist' ? 56 : 52}
                                rowComponent={VirtualRow}
                                rowProps={rowData}
                                overscanCount={8}
                                className="custom-scrollbar"
                            />
                        )}
                    />
                )}
            </div>
        </div>
    );
}
