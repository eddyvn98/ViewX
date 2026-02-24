'use client';

import { useMarketStore } from '@/lib/store';
import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';
import { cn } from '@/lib/utils';
import { SymbolIcon } from '@/features/chart/components/SymbolIcon';
import { Trash2, Search, Star } from 'lucide-react';
import React, { useMemo, useState, memo, useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

type DataSource = 'BINANCE' | 'MT5';

interface TickerRowProps {
    symbol: string;
    source: DataSource;
    isActive: boolean;
    isWatched: boolean;
    onSelect: (symbol: string, source: DataSource) => void;
    onRemove: (symbol: string) => void;
    onAdd: (symbol: string) => void;
    mode: 'discovery' | 'watchlist';
}

/**
 * TickerRow with DOM-based price updates
 * Prevents re-renders on every ticker update
 */
const TickerRow = memo(function TickerRow({ symbol, source, isActive, isWatched, onSelect, onRemove, onAdd, mode }: TickerRowProps) {
    const priceRef = useRef<HTMLSpanElement>(null);
    const changeRef = useRef<HTMLDivElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastPriceRef = useRef<string>('');

    // RAF-based price update - bypasses React
    const updateDOM = useCallback(() => {
        const state = useMarketStore.getState();
        const ticker = state.tickers[symbol];
        if (!ticker) return;

        const price = ticker.price || 0;
        const priceStr = price < 1 ? price.toFixed(4) : price.toFixed(price > 1000 ? 1 : 2);

        if (priceStr !== lastPriceRef.current && priceRef.current) {
            lastPriceRef.current = priceStr;
            priceRef.current.textContent = priceStr || '---';
        }

        if (changeRef.current && mode === 'watchlist') {
            const change = ticker.change || 0;
            const changeValue = ticker.changeValue || 0;
            const changeValueStr = (changeValue > 0 ? '+' : '') + changeValue.toFixed(price < 10 ? 4 : 2);
            const changePercentStr = `(${change > 0 ? '+' : ''}${change.toFixed(2)}%)`;

            changeRef.current.innerHTML = `
                <span>${changeValueStr}</span>
                <span class="opacity-60 text-[10px]">${changePercentStr}</span>
            `;
            changeRef.current.className = cn(
                "flex items-center gap-1.5 text-[12px] font-bold justify-end",
                change >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
            );
        }
    }, [symbol, mode]);

    useEffect(() => {
        if (mode !== 'watchlist') return;

        const interval = 500;
        let lastUpdate = 0;

        const tick = () => {
            const now = Date.now();
            if (now - lastUpdate >= interval) {
                lastUpdate = now;
                updateDOM();
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [updateDOM, mode]);

    return (
        <div
            onClick={() => onSelect(symbol, source)}
            className={cn(
                "grid grid-cols-[3fr_3fr_4.5fr] items-center px-3 py-2.5 mx-3 cursor-pointer hover:bg-white/[0.03] transition-all border-b border-border dark:border-white/[0.02] last:border-0 group min-h-[48px] gap-2 relative overflow-hidden",
                isActive && mode === 'watchlist' && "bg-secondary/50 dark:bg-white/[0.05] rounded-xl border-b-transparent shadow-sm my-1.5"
            )}
        >
            {isActive && mode === 'watchlist' && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl z-20" />
            )}
            {isActive && mode === 'watchlist' && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.05] to-transparent pointer-events-none" />
            )}

            {/* Column 1: Symbol & Source */}
            <div className="min-w-0 flex items-center gap-2.5 relative z-10">
                <SymbolIcon symbol={symbol} className="w-6 h-6 shrink-0" />
                <div className="flex flex-col min-w-0">
                    <span className={cn(
                        "text-[13px] font-bold tracking-tight transition-all duration-300 whitespace-nowrap",
                        isActive && mode === 'watchlist' ? "text-foreground dark:text-white" : "text-foreground dark:text-white group-hover:text-primary dark:group-hover:text-white"
                    )}>
                        {symbol.replace('USDT', '').replace('USDTm', '')}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground uppercase leading-none mt-0.5 group-hover:text-foreground dark:group-hover:text-white/40 transition-colors">{source}</span>
                </div>
            </div>

            {mode === 'watchlist' ? (
                <>
                    {/* Column 2: Price */}
                    <div className="text-right overflow-hidden relative z-10 pr-2">
                        <span ref={priceRef} className="text-foreground dark:text-white/90 text-[13px] font-bold group-hover:text-foreground dark:group-hover:text-white transition-colors tracking-tight">···</span>
                    </div>

                    {/* Column 3: Change */}
                    <div className="text-right flex flex-col items-end overflow-hidden relative z-10">
                        <div ref={changeRef} className="text-[12px] font-bold text-muted-foreground/50 dark:text-muted-foreground/40 mt-0.5 truncate w-full flex justify-end">
                            <span>--</span>
                        </div>
                    </div>

                    {/* Column 4: Actions (Absolute overlay) */}
                    <div className="absolute right-0 inset-y-0 flex items-center pr-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all pointer-events-auto shadow-lg backdrop-blur-md border border-rose-500/20"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-end relative z-10">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isWatched) onRemove(symbol);
                            else onAdd(symbol);
                        }}
                        className={cn(
                            "p-1.5 rounded-xl transition-all border",
                            isWatched
                                ? "text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent hover:border-border"
                        )}
                    >
                        <Star size={13} fill={isWatched ? "currentColor" : "none"} />
                    </button>
                </div>
            )}
        </div>
    );
});

interface MarketListProps {
    mode?: 'discovery' | 'watchlist';
}

function MarketListInternal({ mode = 'discovery' }: MarketListProps) {
    const watchlist = useMarketStore((state) => state.watchlist);
    const addToWatchlist = useMarketStore((state) => state.addToWatchlist);
    const removeFromWatchlist = useMarketStore((state) => state.removeFromWatchlist);

    // ⚡ PERFORMANCE FIX: Only subscribe to symbol NAMES, not ticker data
    // Prices are updated via RAF in each TickerRow
    const allSymbols = useMarketStore(useShallow((state) => Object.keys(state.tickers)));

    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore(useShallow(state => activeTabId ? state.tabs[activeTabId] : null));

    const activeChartId = activeTab?.activeChartId || null;
    const charts = activeTab?.charts || {};
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const { broadcastSymbolChange, broadcastGroupSymbolChange } = useCrossWindowSync();

    const activeChartSymbol = (activeChartId && charts[activeChartId]) ? charts[activeChartId].symbol : null;

    const [search, setSearch] = useState('');
    const [sourceTab, setSourceTab] = useState<'ALL' | 'BINANCE' | 'MT5'>('ALL');

    // FORCE DEFAULT WATCHLIST IF EMPTY
    React.useEffect(() => {
        if (watchlist.length === 0) {
            console.log("Empty watchlist detected, adding defaults...");
            ['BTCUSDm', 'XAUUSDm', 'EURUSDm'].forEach(s => addToWatchlist(s));
        }
    }, [watchlist.length, addToWatchlist]);

    const availableSymbols = useMarketStore((state) => state.availableSymbols);

    // Memoized symbol list - never includes ticker DATA, only names
    const symbolList = useMemo(() => {
        let symbols: { symbol: string; source: DataSource }[] = [];

        if (mode === 'watchlist') {
            symbols = watchlist.map(symbol => {
                const isMT5 = symbol.includes('USD') || symbol.endsWith('m') || !symbol.includes('USDT');
                return { symbol, source: (isMT5 ? 'MT5' : 'BINANCE') as DataSource };
            });
        } else {
            // Discovery mode: use dynamic available symbols from store
            if (availableSymbols.length > 0) {
                symbols = availableSymbols.map(s => ({
                    symbol: s.symbol,
                    source: 'MT5' as DataSource
                }));
            } else {
                // Fallback to currently active tickers if availableSymbols is empty
                symbols = allSymbols.map(symbol => {
                    const isMT5 = symbol.includes('USD') || symbol.endsWith('m') || !symbol.includes('USDT');
                    return { symbol, source: (isMT5 ? 'MT5' : 'BINANCE') as DataSource };
                });
            }
        }

        return symbols
            .filter(t => {
                const s = t.symbol.toLowerCase();
                const matchesSearch = s.includes(search.toLowerCase());
                const matchesTab = sourceTab === 'ALL' || t.source === sourceTab;
                return matchesSearch && matchesTab;
            })
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }, [allSymbols, availableSymbols, search, sourceTab, watchlist, mode]);

    const handleSymbolSelect = useCallback((symbol: string, source: 'BINANCE' | 'MT5') => {
        if (activeChartId) {
            const chart = charts[activeChartId];
            setChartSymbol(activeChartId, symbol);

            if (chart?.group && chart.group !== 'none') {
                broadcastGroupSymbolChange(chart.group, symbol, source);
            } else {
                broadcastSymbolChange(activeChartId, symbol, source);
            }

            if (mode === 'discovery' && !watchlist.includes(symbol)) {
                addToWatchlist(symbol);
            }
        }
    }, [activeChartId, charts, mode, setChartSymbol, watchlist, addToWatchlist, broadcastGroupSymbolChange, broadcastSymbolChange]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent min-h-0 h-full">
            {/* Premium Header: Search & Filters */}
            <div className="px-3 py-2 border-b border-border dark:border-white/[0.03] flex items-center justify-between shrink-0 bg-secondary/50 dark:bg-white/[0.02]">
                <div className="relative flex-1 group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 dark:text-white/10 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Quick search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-secondary/50 dark:bg-white/[0.03] border border-border dark:border-white/5 rounded-lg pl-8 pr-3 py-1 text-[11px] text-foreground font-medium transition-all h-7 focus:bg-background outline-none"
                    />
                </div>

                <div className="flex bg-secondary/50 dark:bg-white/[0.03] p-0.5 rounded-xl border border-border dark:border-white/5 h-7 ml-2 shadow-sm">
                    {['ALL', 'BINANCE', 'MT5'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSourceTab(tab as any)}
                            className={cn(
                                "px-2.5 text-[9px] font-bold rounded-lg transition-all flex items-center justify-center tracking-wide",
                                sourceTab === tab
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground/60 hover:text-foreground"
                            )}
                        >
                            {tab === 'BINANCE' ? 'CRYPTO' : tab === 'MT5' ? 'FOREX' : 'ALL'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Header */}
            {mode === 'watchlist' && (
                <div className="grid grid-cols-[3fr_3fr_4.5fr] items-center mx-3 px-3 py-2 bg-transparent text-[10px] text-muted-foreground font-bold uppercase tracking-wider shrink-0 gap-2 border-b border-border/5 mt-1">
                    <span className="truncate opacity-50">Symbol</span>
                    <span className="text-right opacity-50">Live price</span>
                    <span className="text-right opacity-50">Change</span>
                </div>
            )}

            {/* Scrollable List Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/5">
                {symbolList.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-xs italic">
                        {mode === 'watchlist' ? 'Your watchlist is empty' : 'No tickers found'}
                    </div>
                ) : (
                    symbolList.map((item) => (
                        <TickerRow
                            key={item.symbol}
                            symbol={item.symbol}
                            source={item.source}
                            mode={mode}
                            isActive={activeChartSymbol === item.symbol}
                            isWatched={watchlist.includes(item.symbol)}
                            onSelect={handleSymbolSelect}
                            onAdd={addToWatchlist}
                            onRemove={removeFromWatchlist}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export const MarketList = memo(MarketListInternal);
