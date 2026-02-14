'use client';

import { useMarketStore } from '@/lib/store';
import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';
import { cn } from '@/lib/utils';
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
                <span class="opacity-60 text-[9px]">${changePercentStr}</span>
            `;
            changeRef.current.className = cn(
                "flex items-center gap-1.5 font-mono text-[11px] font-bold",
                change >= 0 ? "text-green-500" : "text-red-500"
            );
        }
    }, [symbol, mode]);

    useEffect(() => {
        if (mode !== 'watchlist') return;

        // Tối ưu hóa: Thay vì chạy liên tục, ta đăng ký vào một sự kiện trung tâm
        // hoặc chỉ cập nhật khi tab này thực sự hiển thị.
        // Tăng interval lên 500ms (2fps) cho danh sách phụ để cứu CPU.
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
                "grid grid-cols-[1fr_1fr_1fr_24px] items-center px-3 py-1 cursor-pointer hover:bg-white/5 transition-all border-b border-white/5 last:border-0 group min-h-[36px] gap-2",
                isActive && mode === 'watchlist' && "bg-blue-500/10 border-l-2 border-l-blue-500"
            )}
        >
            {/* Column 1: Symbol & Source */}
            <div className="min-w-0 flex flex-col overflow-hidden">
                <span className={cn(
                    "text-[11px] font-bold tracking-tight truncate",
                    isActive && mode === 'watchlist' ? "text-blue-400" : "text-zinc-200"
                )}>
                    {symbol.replace('USDT', '').replace('USDTm', '')}
                </span>
                <span className="text-[8px] font-black text-zinc-500 uppercase leading-none tracking-tight">{source}</span>
            </div>

            {mode === 'watchlist' ? (
                <>
                    {/* Column 2: Price */}
                    <div className="text-right overflow-hidden">
                        <span ref={priceRef} className="text-zinc-300 font-mono text-[11px]">···</span>
                    </div>

                    {/* Column 3: Change */}
                    <div className="text-right flex flex-col items-end overflow-hidden">
                        <div ref={changeRef} className="font-mono text-[10px] font-bold text-zinc-500 truncate w-full">
                            <span>--</span>
                        </div>
                    </div>

                    {/* Column 4: Actions */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
                        className="flex justify-center text-zinc-600 hover:text-red-400 transition-all md:opacity-0 md:group-hover:opacity-100"
                    >
                        <Trash2 size={10} />
                    </button>
                </>
            ) : (
                <div className="col-span-3 flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isWatched) onRemove(symbol);
                            else onAdd(symbol);
                        }}
                        className={cn(
                            "p-1 rounded-md transition-all",
                            isWatched ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                        )}
                    >
                        <Star size={12} fill={isWatched ? "currentColor" : "none"} />
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

    // Memoized symbol list - never includes ticker DATA, only names
    const symbolList = useMemo(() => {
        let symbols: { symbol: string; source: DataSource }[] = [];

        if (mode === 'watchlist') {
            symbols = watchlist.map(symbol => {
                const isMT5 = symbol.includes('USD') || symbol.endsWith('m') || !symbol.includes('USDT');
                return { symbol, source: (isMT5 ? 'MT5' : 'BINANCE') as DataSource };
            });
        } else {
            // Discovery mode: get source from store without subscribing to price changes
            symbols = allSymbols.map(symbol => {
                const isMT5 = symbol.includes('USD') || symbol.endsWith('m') || !symbol.includes('USDT');
                return { symbol, source: (isMT5 ? 'MT5' : 'BINANCE') as DataSource };
            });
        }

        return symbols
            .filter(t => {
                const s = t.symbol.toLowerCase();
                const matchesSearch = s.includes(search.toLowerCase());
                const matchesTab = sourceTab === 'ALL' || t.source === sourceTab;
                return matchesSearch && matchesTab;
            })
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }, [allSymbols, search, sourceTab, watchlist, mode]);

    const debugInfo = `S:${allSymbols.length} W:${watchlist.length} L:${symbolList.length}`;

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
            {/* Ultra Compact Header: Search & Filters on same row */}
            <div className="p-1.5 border-b border-zinc-800 flex items-center gap-1.5 shrink-0 bg-zinc-900/20">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1.5 h-3 w-3 text-zinc-600" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-md pl-7 pr-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500/50 placeholder-zinc-700 transition-colors h-6"
                    />
                </div>

                <div className="flex bg-zinc-950/80 p-0.5 rounded-md border border-zinc-800/50 h-6">
                    {['ALL', 'BINANCE', 'MT5'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSourceTab(tab as any)}
                            className={cn(
                                "px-2 text-[9px] font-bold rounded-sm transition-all flex items-center justify-center",
                                sourceTab === tab
                                    ? "bg-zinc-800 text-white"
                                    : "text-zinc-600 hover:text-zinc-400"
                            )}
                        >
                            {tab === 'BINANCE' ? 'C' : tab === 'MT5' ? 'F' : 'A'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Header */}
            {mode === 'watchlist' && (
                <div className="grid grid-cols-[1fr_1fr_1fr_24px] items-center px-3 py-1.5 bg-zinc-950/50 text-[9px] text-zinc-600 font-bold uppercase tracking-wider shrink-0 gap-2">
                    <span className="truncate">Symbol</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Change</span>
                    <span></span> {/* Pad for actions */}
                </div>
            )}

            {/* Scrollable List Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-950/20">
                {symbolList.length === 0 ? (
                    <div className="p-10 text-center text-zinc-600 text-xs italic">
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
