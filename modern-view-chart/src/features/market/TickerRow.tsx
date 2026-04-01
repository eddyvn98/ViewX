'use client';

import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { SymbolIcon } from '@/features/chart/components/SymbolIcon';
import { Star, Trash2 } from 'lucide-react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { SymbolDisplayMeta } from './build-symbol-list';

export type TickerRowMode = 'discovery' | 'watchlist';

export interface TickerRowProps {
    symbol: string;
    source: 'BINANCE' | 'MT5';
    meta?: SymbolDisplayMeta;
    isActive: boolean;
    isWatched: boolean;
    onSelect: (symbol: string, source: 'BINANCE' | 'MT5') => void;
    onRemove: (symbol: string) => void;
    onAdd: (symbol: string) => void;
    mode: TickerRowMode;
}

export const TickerRow = memo(function TickerRow({
    symbol,
    source,
    meta,
    isActive,
    isWatched,
    onSelect,
    onRemove,
    onAdd,
    mode,
}: TickerRowProps) {
    const removeFromWatchlist = useMarketStore((state) => state.removeFromWatchlist);
    const priceRef = useRef<HTMLSpanElement>(null);
    const changeRef = useRef<HTMLDivElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastPriceRef = useRef<string>('');
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchRef = useRef({ startX: 0, startY: 0, swiping: false });

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
                <span class="opacity-60 text-[11px]">${changePercentStr}</span>
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

    const rawSymbol = String(meta?.rawSymbol || '').trim();
    const canonicalSymbol = String(meta?.canonicalSymbol || '').trim();
    const accountLogin = String(meta?.accountLogin || '').trim();
    const server = String(meta?.server || '').trim();
    const hasMultiBrokerMeta = Boolean(accountLogin || server || (canonicalSymbol && canonicalSymbol !== symbol) || (rawSymbol && rawSymbol !== symbol));

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => {
                if (mode === 'watchlist' && swipeOffset > 0) return;
                onSelect(symbol, source);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (mode === 'watchlist' && swipeOffset > 0) return;
                    onSelect(symbol, source);
                }
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            data-testid={`watchlist-row-${symbol}`}
            className={cn(
                "px-3 py-2.5 mx-3 cursor-pointer hover:bg-white/[0.03] transition-all border-b border-border dark:border-white/[0.02] last:border-0 group min-h-[48px] gap-2 relative overflow-hidden touch-pan-y select-none",
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
                        <span
                            className={cn(
                                "text-[13px] font-bold tracking-tight transition-all duration-300 whitespace-nowrap",
                                isActive && mode === 'watchlist' ? "text-foreground dark:text-white" : "text-foreground dark:text-white group-hover:text-primary dark:group-hover:text-white"
                            )}
                        >
                            {symbol.replace('USDT', '').replace('USDTm', '')}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground uppercase leading-none mt-0.5 group-hover:text-foreground dark:group-hover:text-white/40 transition-colors">{source}</span>
                        {hasMultiBrokerMeta && (
                            <span className="text-[10px] font-medium text-cyan-300/90 leading-none mt-1 truncate max-w-[180px]">
                                {accountLogin ? `ACC ${accountLogin}` : source}
                                {server ? ` • ${server}` : ''}
                            </span>
                        )}
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
