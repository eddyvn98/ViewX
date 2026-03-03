'use client';

import { useMarketStore } from '@/lib/store';
import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';
import { cn } from '@/lib/utils';
import { SymbolIcon } from '@/features/chart/components/SymbolIcon';
import { Trash2, Search, Star } from 'lucide-react';
import React, { useMemo, useState, memo, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { List, type RowComponentProps } from 'react-window';

type DataSource = 'BINANCE' | 'MT5';
type SourceTab = 'ALL' | 'BINANCE' | 'MT5';
const SOURCE_TABS: SourceTab[] = ['ALL', 'BINANCE', 'MT5'];
const DEFAULT_BINANCE_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

function resolveDataSource(symbol: string): DataSource {
    const normalized = String(symbol || '').toUpperCase();
    return normalized.includes('USDT') ? 'BINANCE' : 'MT5';
}

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
    const removeFromWatchlist = useMarketStore((state) => state.removeFromWatchlist);
    const priceRef = useRef<HTMLSpanElement>(null);
    const changeRef = useRef<HTMLDivElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastPriceRef = useRef<string>('');
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchRef = useRef({ startX: 0, startY: 0, swiping: false });

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

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (mode !== 'watchlist') return;
        const touch = e.touches[0];
        if (!touch) return;
        touchRef.current = { startX: touch.clientX, startY: touch.clientY, swiping: false };
    }, [mode]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (mode !== 'watchlist') return;
        const touch = e.touches[0];
        if (!touch) return;

        const dx = touch.clientX - touchRef.current.startX;
        const dy = touch.clientY - touchRef.current.startY;

        if (!touchRef.current.swiping) {
            if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
            touchRef.current.swiping = true;
        }

        e.preventDefault();
        const nextOffset = Math.max(0, Math.min(56, -dx));
        setSwipeOffset(nextOffset);
    }, [mode]);

    const handleTouchEnd = useCallback(() => {
        if (mode !== 'watchlist') return;
        if (!touchRef.current.swiping) {
            if (swipeOffset > 0) setSwipeOffset(0);
            return;
        }

        setSwipeOffset((prev) => (prev > 28 ? 56 : 0));
        touchRef.current.swiping = false;
    }, [mode, swipeOffset]);

    return (
        <div
            onClick={() => {
                if (mode === 'watchlist' && swipeOffset > 0) return;
                onSelect(symbol, source);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={cn(
                "px-3 py-2.5 mx-3 cursor-pointer hover:bg-white/[0.03] transition-all border-b border-border dark:border-white/[0.02] last:border-0 group min-h-[48px] gap-2 relative overflow-hidden touch-pan-y",
                isActive && mode === 'watchlist' && "bg-secondary/50 dark:bg-white/[0.05] rounded-xl border-b-transparent shadow-sm my-1.5"
            )}
        >
            {mode === 'watchlist' && (
                <div
                    className={cn(
                        "absolute right-0 inset-y-0 w-14 flex items-center justify-center pr-2 md:pr-3 z-30 transition-opacity",
                        swipeOffset > 0 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"
                    )}
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFromWatchlist(symbol);
                            setSwipeOffset(0);
                        }}
                        aria-label={`Remove ${symbol} from watchlist`}
                        className="h-9 w-9 md:h-8 md:w-8 flex items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg backdrop-blur-md border border-rose-500/30 active:scale-95"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}

            <div
                className="grid grid-cols-[3fr_3fr_4.5fr] items-center gap-2 relative z-10 transition-transform duration-200"
                style={mode === 'watchlist' ? { transform: `translateX(-${swipeOffset}px)` } : undefined}
            >
                {isActive && mode === 'watchlist' && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl z-20" />
                )}
                {isActive && mode === 'watchlist' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.05] to-transparent pointer-events-none" />
                )}

                <div className="min-w-0 flex items-center gap-2.5 relative z-10">
                    <SymbolIcon symbol={symbol} className="w-7 h-7 shrink-0" />
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
                        <div className="text-right overflow-hidden relative z-10 pr-2">
                            <span ref={priceRef} className="text-foreground dark:text-white/90 text-[13px] font-bold group-hover:text-foreground dark:group-hover:text-white transition-colors tracking-tight">...</span>
                        </div>

                        <div className="text-right flex flex-col items-end overflow-hidden relative z-10">
                            <div ref={changeRef} className="text-[12px] font-bold text-muted-foreground/50 dark:text-muted-foreground/40 mt-0.5 truncate w-full flex justify-end">
                                <span>--</span>
                            </div>
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
        </div>
    );
});

interface MarketListProps {
    mode?: 'discovery' | 'watchlist';
}

interface RowData {
    items: { symbol: string; source: DataSource }[];
    mode: 'discovery' | 'watchlist';
    activeChartSymbol: string | null;
    watchedSet: Set<string>;
    onSelect: (symbol: string, source: DataSource) => void;
    onAdd: (symbol: string) => void;
    onRemove: (symbol: string) => void;
}

function VirtualRow({ index, style, ...data }: RowComponentProps<RowData>): React.ReactElement | null {
    const item = data.items[index];
    if (!item) return null;

    return (
        <div style={style}>
            <TickerRow
                symbol={item.symbol}
                source={item.source}
                mode={data.mode}
                isActive={data.activeChartSymbol === item.symbol}
                isWatched={data.watchedSet.has(item.symbol)}
                onSelect={data.onSelect}
                onAdd={data.onAdd}
                onRemove={data.onRemove}
            />
        </div>
    );
}

function MarketListInternal({ mode = 'discovery' }: MarketListProps) {
    const watchlist = useMarketStore((state) => state.watchlist);
    const addToWatchlist = useMarketStore((state) => state.addToWatchlist);
    const removeFromWatchlist = useMarketStore((state) => state.removeFromWatchlist);

    // âš¡ PERFORMANCE FIX: Only subscribe to symbol NAMES, not ticker data
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
    const deferredSearch = useDeferredValue(search);
    const [sourceTab, setSourceTab] = useState<SourceTab>('ALL');
    const [binanceUniverse, setBinanceUniverse] = useState<string[]>([]);

    // FORCE DEFAULT WATCHLIST IF EMPTY
    React.useEffect(() => {
        if (watchlist.length === 0) {
            console.log("Empty watchlist detected, adding defaults...");
            ['BTCUSDm', 'XAUUSDm', 'EURUSDm'].forEach(s => addToWatchlist(s));
        }
    }, [watchlist.length, addToWatchlist]);

    const availableSymbols = useMarketStore((state) => state.availableSymbols);

    useEffect(() => {
        if (mode !== 'discovery') return;
        const controller = new AbortController();

        const loadBinanceSymbols = async () => {
            try {
                const res = await fetch('https://api.binance.com/api/v3/exchangeInfo', {
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (!res.ok) return;
                const data = await res.json();
                const symbols = Array.isArray(data?.symbols)
                    ? data.symbols
                        .filter((s: any) => s?.status === 'TRADING' && String(s?.symbol || '').endsWith('USDT'))
                        .map((s: any) => String(s.symbol))
                    : [];
                if (symbols.length > 0) {
                    setBinanceUniverse(Array.from(new Set(symbols)));
                }
            } catch {
                // Ignore fetch failures; UI still has websocket/default fallback symbols.
            }
        };

        void loadBinanceSymbols();
        return () => controller.abort();
    }, [mode]);

    // Memoized symbol list - never includes ticker DATA, only names
    const symbolList = useMemo(() => {
        let symbols: { symbol: string; source: DataSource }[] = [];

        if (mode === 'watchlist') {
            symbols = watchlist.map(symbol => {
                return { symbol, source: resolveDataSource(symbol) };
            });
        } else {
            const map = new Map<string, DataSource>();

            // MT5 symbol universe from bridge
            availableSymbols.forEach((s) => {
                const symbol = String(s?.symbol || '').trim();
                if (!symbol) return;
                map.set(symbol, resolveDataSource(symbol));
            });

            // Live symbols from websocket tickers (includes Binance)
            allSymbols.forEach((symbol) => {
                const normalized = String(symbol || '').trim();
                if (!normalized) return;
                map.set(normalized, resolveDataSource(normalized));
            });

            // Keep core Binance symbols visible even before first WS ticker batch arrives
            DEFAULT_BINANCE_SYMBOLS.forEach((symbol) => {
                if (!map.has(symbol)) map.set(symbol, 'BINANCE');
            });
            binanceUniverse.forEach((symbol) => {
                if (!map.has(symbol)) map.set(symbol, 'BINANCE');
            });

            symbols = Array.from(map.entries()).map(([symbol, source]) => ({ symbol, source }));
        }

        return symbols
            .filter(t => {
                const s = t.symbol.toLowerCase();
                const matchesSearch = s.includes(deferredSearch.toLowerCase());
                const matchesTab = sourceTab === 'ALL' || t.source === sourceTab;
                return matchesSearch && matchesTab;
            })
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }, [allSymbols, availableSymbols, deferredSearch, sourceTab, watchlist, mode, binanceUniverse]);

    const watchedSet = useMemo(() => new Set(watchlist), [watchlist]);

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

    const rowData = useMemo<RowData>(() => ({
        items: symbolList,
        mode,
        activeChartSymbol,
        watchedSet,
        onSelect: handleSymbolSelect,
        onAdd: addToWatchlist,
        onRemove: removeFromWatchlist,
    }), [symbolList, mode, activeChartSymbol, watchedSet, handleSymbolSelect, addToWatchlist, removeFromWatchlist]);

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
                    {SOURCE_TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSourceTab(tab)}
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
            <div className="flex-1 min-h-0 bg-background/5">
                {symbolList.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-xs italic">
                        {mode === 'watchlist' ? 'Your watchlist is empty' : 'No tickers found'}
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

export const MarketList = memo(MarketListInternal);

