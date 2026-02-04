'use client';

import { useMarketStore } from '@/lib/store';
import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';
import { cn } from '@/lib/utils';
import { Trash2, Search, Star } from 'lucide-react';
import React, { useMemo, useState, memo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

const EMPTY_CHARTS: any = {};

// Memoized ticker row that subscribes to its own data
const TickerRow = memo(({ symbol, isActive, isWatched, onSelect, onRemove, mode, onAdd }: any) => {
    // Select only the specific ticker data
    const ticker = useMarketStore(useShallow((state) => state.tickers[symbol] || { symbol, source: 'BINANCE' }));

    return (
        <div
            onClick={() => onSelect(ticker.symbol, ticker.source)}
            className={cn(
                "flex justify-between items-center px-4 py-2.5 cursor-pointer hover:bg-zinc-800/30 transition-all border-b border-zinc-800/50 last:border-0 group",
                isActive && mode === 'watchlist' && "bg-blue-500/10 border-l-2 border-l-blue-500"
            )}
        >
            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <span className={cn(
                        "text-[13px] font-bold tracking-tight",
                        isActive && mode === 'watchlist' ? "text-blue-400" : "text-zinc-300"
                    )}>
                        {(ticker.symbol || '').replace('USDT', '')}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase">{ticker.source}</span>
                </div>
            </div>

            {mode === 'watchlist' ? (
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-zinc-400 font-mono text-[13px]">
                            {ticker.price ? (ticker.price < 1 ? ticker.price.toFixed(4) : ticker.price.toFixed(2)) : '---'}
                        </span>
                        <div className={cn(
                            "flex items-center gap-1.5 font-mono text-[11px] font-bold",
                            (ticker.change || 0) >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            <span>
                                {(ticker.changeValue || 0) > 0 ? '+' : ''}
                                {(ticker.changeValue || 0).toFixed(ticker.price < 10 ? 4 : 2)}
                            </span>
                            <span className="opacity-60 text-[9px]">
                                ({(ticker.change || 0) > 0 ? '+' : ''}{(ticker.change || 0).toFixed(2)}%)
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(ticker.symbol);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-400 transition-all"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isWatched) {
                                onRemove(ticker.symbol);
                            } else {
                                onAdd(ticker.symbol);
                            }
                        }}
                        className={cn(
                            "p-1.5 rounded-md transition-all",
                            isWatched
                                ? "text-yellow-500 bg-yellow-500/10"
                                : "text-zinc-600 hover:text-white hover:bg-zinc-800"
                        )}
                    >
                        <Star size={14} fill={isWatched ? "currentColor" : "none"} />
                    </button>
                </div>
            )}
        </div>
    )
});

TickerRow.displayName = 'TickerRow';

interface MarketListProps {
    mode?: 'discovery' | 'watchlist';
}

function MarketListInternal({ mode = 'discovery' }: MarketListProps) {
    const tickers = useMarketStore(useShallow((state) => state.tickers));
    const watchlist = useMarketStore((state) => state.watchlist);
    const addToWatchlist = useMarketStore((state) => state.addToWatchlist);
    const removeFromWatchlist = useMarketStore((state) => state.removeFromWatchlist);

    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore(useShallow(state => state.tabs[activeTabId || '']));

    const activeChartId = activeTab?.activeChartId || null;
    const charts = activeTab?.charts || EMPTY_CHARTS;
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const { broadcastSymbolChange, broadcastGroupSymbolChange } = useCrossWindowSync();

    const activeChartSymbol = activeChartId ? charts[activeChartId]?.symbol : null;

    const [search, setSearch] = useState('');
    const [sourceTab, setSourceTab] = useState<'ALL' | 'BINANCE' | 'MT5'>('ALL');

    const tickerList = useMemo(() => {
        let list = Object.values(tickers);

        if (mode === 'watchlist') {
            list = list.filter(t => watchlist.includes(t.symbol));
        }

        return list
            .filter(t => {
                const matchesSearch = (t.symbol || '').toLowerCase().includes(search.toLowerCase());
                const matchesTab = sourceTab === 'ALL' || t.source === sourceTab;
                return matchesSearch && matchesTab;
            })
            .sort((a, b) => {
                // If in discovery, maybe sort by name, if in watchlist sort by volume or just keep it
                if (mode === 'discovery') return a.symbol.localeCompare(b.symbol);
                return (b.volume || 0) - (a.volume || 0);
            });
    }, [tickers, search, sourceTab, watchlist, mode]);

    const handleSymbolSelect = useCallback((symbol: string, source: 'BINANCE' | 'MT5') => {
        if (activeChartId) {
            const chart = charts[activeChartId];
            setChartSymbol(activeChartId, symbol);

            if (chart?.group && chart.group !== 'none') {
                broadcastGroupSymbolChange(chart.group, symbol, source);
            } else {
                broadcastSymbolChange(activeChartId, symbol, source);
            }

            // AUTO-ADD TO WATCHLIST if selected from discovery list
            if (mode === 'discovery' && !watchlist.includes(symbol)) {
                addToWatchlist(symbol);
            }
        }
    }, [activeChartId, charts, mode, setChartSymbol, watchlist, addToWatchlist, broadcastGroupSymbolChange, broadcastSymbolChange]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent min-h-0">
            {/* Header / Search */}
            <div className="p-3 border-b border-zinc-800 space-y-3 shrink-0">
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    {['ALL', 'BINANCE', 'MT5'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSourceTab(tab as any)}
                            className={cn(
                                "flex-1 text-[11px] font-bold py-1.5 rounded-md transition-all",
                                sourceTab === tab
                                    ? "bg-zinc-800 text-white shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {tab === 'BINANCE' ? 'CRYPTO' : tab === 'MT5' ? 'FOREX' : 'ALL'}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-600" />
                    <input
                        type="text"
                        placeholder={mode === 'watchlist' ? "Search watchlist..." : "Search symbols..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-zinc-700 transition-colors"
                    />
                </div>
            </div>

            {/* List Header */}
            {mode === 'watchlist' && (
                <div className="flex justify-between px-4 py-2 bg-zinc-950/50 text-[10px] text-zinc-600 font-bold uppercase tracking-wider shrink-0">
                    <span>Symbol</span>
                    <div className="flex gap-4">
                        <span className="w-16 text-right">Price</span>
                        <span className="w-24 text-right">24h Change</span>
                    </div>
                </div>
            )}

            {/* Scrollable List Area */}
            <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                    {tickerList.length === 0 ? (
                        <div className="p-4 text-center text-zinc-600 text-xs italic">
                            {mode === 'watchlist' ? 'Your watchlist is empty' : 'No tickers found'}
                        </div>
                    ) : (
                        tickerList.map((ticker) => (
                            <TickerRow
                                key={ticker.symbol}
                                symbol={ticker.symbol}
                                mode={mode}
                                isActive={activeChartSymbol === ticker.symbol}
                                isWatched={watchlist.includes(ticker.symbol)}
                                onSelect={handleSymbolSelect}
                                onAdd={addToWatchlist}
                                onRemove={removeFromWatchlist}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Export memoized version to prevent unnecessary re-renders
export const MarketList = memo(MarketListInternal);
