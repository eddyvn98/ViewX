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
                "flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-all border-b border-white/5 last:border-0 group min-h-[60px]",
                isActive && mode === 'watchlist' && "bg-blue-500/10 border-l-2 border-l-blue-500"
            )}
        >
            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <span className={cn(
                        "text-[14px] font-bold tracking-tight",
                        isActive && mode === 'watchlist' ? "text-blue-400" : "text-zinc-200"
                    )}>
                        {symbol.replace('USDT', '').replace('USDTm', '')}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{source}</span>
                </div>
            </div>

            {mode === 'watchlist' ? (
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex flex-col items-end">
                        <span ref={priceRef} className="text-zinc-300 font-mono text-[14px]">···</span>
                        <div ref={changeRef} className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-zinc-500">
                            <span>--</span>
                        </div>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-all md:opacity-0 md:group-hover:opacity-100"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isWatched) onRemove(symbol);
                            else onAdd(symbol);
                        }}
                        className={cn(
                            "p-2 rounded-md transition-all",
                            isWatched ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                        )}
                    >
                        <Star size={18} fill={isWatched ? "currentColor" : "none"} />
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
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent min-h-[300px] h-full">
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

                {/* Mobile Debug Tag */}
                <div className="md:hidden text-[9px] text-zinc-700 font-mono text-center">
                    {debugInfo}
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
