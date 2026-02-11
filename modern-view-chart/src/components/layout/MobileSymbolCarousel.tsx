'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface MobileSymbolCarouselProps {
    onSymbolTap?: () => void;
    isDimmed?: boolean;
}

export function MobileSymbolCarousel({ onSymbolTap, isDimmed = false }: MobileSymbolCarouselProps) {
    const watchlist = useMarketStore(state => state.watchlist);
    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeTab = useMarketStore(state => state.tabs[activeTabId]);
    const setChartSymbol = useMarketStore(state => state.setChartSymbol);

    const activeChartId = activeTab?.activeChartId || 'default';
    const currentSymbol = activeTab?.charts[activeChartId]?.symbol;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [centerSymbol, setCenterSymbol] = useState(currentSymbol);
    const lastEmittedSymbol = useRef(currentSymbol);
    const initialCentered = useRef(false);

    const infiniteSymbols = [...watchlist, ...watchlist, ...watchlist];

    // Effect to handle visual updates and infinite loop jumping
    useEffect(() => {
        const container = scrollRef.current;
        if (!container || watchlist.length === 0) return;

        const updateVisuals = () => {
            const center = container.scrollLeft + container.clientWidth / 2;
            const items = container.children;
            let closestSymbol = '';
            let minDistance = Infinity;

            // 1. Handle Infinite Jumping (Invisible to user)
            const singleSetWidth = container.scrollWidth / 3;
            if (container.scrollLeft < singleSetWidth * 0.5) {
                container.scrollLeft += singleSetWidth;
            } else if (container.scrollLeft > singleSetWidth * 1.5) {
                container.scrollLeft -= singleSetWidth;
            }

            // 2. Update Scales and Find Center Symbol
            for (let i = 0; i < items.length; i++) {
                const item = items[i] as HTMLElement;
                const itemCenter = item.offsetLeft + item.clientWidth / 2;
                const distance = Math.abs(itemCenter - center);

                // Emphasis transformation: Center is 1.25, sides are 1.0
                const normalizedDistance = Math.min(distance / 120, 1);
                const scale = 1.25 - (normalizedDistance * 0.25);

                item.style.opacity = '1';
                item.style.transform = `scale(${scale})`;
                item.style.filter = 'none';

                if (distance < minDistance) {
                    minDistance = distance;
                    closestSymbol = item.getAttribute('data-symbol') || '';
                }
            }

            if (closestSymbol && closestSymbol !== centerSymbol) {
                setCenterSymbol(closestSymbol);
            }
        };

        container.addEventListener('scroll', updateVisuals);
        updateVisuals();
        return () => container.removeEventListener('scroll', updateVisuals);
    }, [centerSymbol, watchlist]);

    // Emit symbol change when settling
    useEffect(() => {
        if (centerSymbol && centerSymbol !== lastEmittedSymbol.current) {
            const timer = setTimeout(() => {
                setChartSymbol(activeChartId, centerSymbol);
                lastEmittedSymbol.current = centerSymbol;
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [centerSymbol, activeChartId, setChartSymbol]);

    // Initial sync - Center the MIDDLE section
    useEffect(() => {
        if (scrollRef.current && currentSymbol && !initialCentered.current && watchlist.length > 0) {
            const index = watchlist.indexOf(currentSymbol);
            if (index !== -1) {
                const container = scrollRef.current;
                const middleIndex = index + watchlist.length;
                setTimeout(() => {
                    const item = container.children[middleIndex] as HTMLElement;
                    if (item) {
                        const targetScroll = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                        container.scrollTo({ left: targetScroll, behavior: 'auto' });
                        initialCentered.current = true;
                    }
                }, 50);
            }
        }
    }, [currentSymbol, watchlist]);

    return (
        <div
            className={cn(
                "relative w-full h-full bg-transparent flex items-center justify-center transition-all duration-300",
                isDimmed ? "opacity-10 scale-95 pointer-events-none" : "opacity-100 scale-100"
            )}
        >
            <div
                ref={scrollRef}
                className="flex items-center gap-12 overflow-x-auto no-scrollbar snap-x snap-mandatory h-full touch-horizontal"
            >
                {infiniteSymbols.map((symbol, idx) => {
                    const isBinance = symbol.toUpperCase().includes('USDT') && !symbol.endsWith('m');
                    const baseSymbol = symbol.endsWith('m') ? symbol.slice(0, -1) : symbol.replace('USDT', '');
                    const isForex = symbol.length === 7 && symbol.endsWith('m');

                    const logoUrl = isBinance
                        ? `https://s3-symbol-logo.tradingview.com/crypto/XTVC${baseSymbol}.svg`
                        : isForex
                            ? `https://s3-symbol-logo.tradingview.com/country/${baseSymbol.slice(0, 2)}.svg`
                            : `https://s3-symbol-logo.tradingview.com/indices/${baseSymbol.toLowerCase()}.svg`;

                    const isActive = centerSymbol === symbol;

                    return (
                        <div
                            key={`${symbol}-${idx}`}
                            data-symbol={symbol}
                            className="flex-shrink-0 w-max px-3 flex items-center justify-center transition-all duration-300 select-none active:scale-95"
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isActive) {
                                    if (window.navigator.vibrate) window.navigator.vibrate(10);
                                    onSymbolTap?.();
                                    return;
                                }
                                const item = e.currentTarget;
                                const container = scrollRef.current;
                                if (container) {
                                    const targetScroll = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                                    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
                                }
                            }}
                        >
                            <div className={cn(
                                "flex flex-row items-center gap-1.5 transition-all duration-300",
                                isActive ? "text-white" : "text-zinc-500"
                            )}>
                                <div className={cn(
                                    "p-1 rounded-lg transition-all flex items-center justify-center shrink-0",
                                    isActive ? "bg-blue-600/20 shadow-lg shadow-blue-500/10" : "bg-transparent"
                                )}>
                                    <div className={cn(
                                        "w-3.5 h-3.5 rounded-full overflow-hidden flex items-center justify-center transition-transform duration-300",
                                        isActive && "scale-110"
                                    )}>
                                        <img
                                            src={logoUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                const parent = (e.target as HTMLImageElement).parentElement;
                                                if (parent) parent.innerHTML = `<span class="text-[7px] font-black text-zinc-500">${symbol[0]}</span>`;
                                            }}
                                        />
                                    </div>
                                </div>
                                {isActive && (
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-300"
                                    )}>
                                        {symbol}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-zinc-950/20 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-zinc-950/20 to-transparent pointer-events-none z-10" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-1 w-4 h-0.5 bg-blue-500/50 rounded-full pointer-events-none z-20" />
        </div>
    );
}
