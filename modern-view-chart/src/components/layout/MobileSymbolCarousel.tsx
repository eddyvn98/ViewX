'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MobileSymbolCarouselProps {
    onSymbolTap?: () => void;
    isDimmed?: boolean;
}

export function MobileSymbolCarousel({ onSymbolTap, isDimmed = false }: MobileSymbolCarouselProps) {
    const watchlist = useMarketStore(state => state.watchlist);
    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeTab = useMarketStore(state => state.tabs[activeTabId]);
    const tickers = useMarketStore(state => state.tickers);
    const setChartSymbol = useMarketStore(state => state.setChartSymbol);

    const activeChartId = activeTab?.activeChartId || 'default';
    const currentSymbol = activeTab?.charts[activeChartId]?.symbol;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [centerSymbol, setCenterSymbol] = useState(currentSymbol);
    const lastEmittedSymbol = useRef(currentSymbol);

    // Effect to handle visual updates during scroll
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const updateVisuals = () => {
            const center = container.scrollLeft + container.clientWidth / 2;
            const items = container.children;
            let closestSymbol = '';
            let minDistance = Infinity;

            for (let i = 0; i < items.length; i++) {
                const item = items[i] as HTMLElement;
                const itemCenter = item.offsetLeft + item.clientWidth / 2;
                const distance = Math.abs(itemCenter - center);

                // Wheel transformation: Center is 1.0, sides remain readable
                const normalizedDistance = Math.min(distance / 120, 1);
                const opacity = 1 - (normalizedDistance * 0.5); // Fades to 0.5
                const scale = 1.1 - (normalizedDistance * 0.2); // Scales to 0.9
                const blur = normalizedDistance * 0.8; // Reduced blur to 0.8px

                item.style.opacity = opacity.toString();
                item.style.transform = `scale(${scale})`;
                item.style.filter = distance > 50 ? `blur(${blur}px)` : 'none';

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

    // Initial sync
    useEffect(() => {
        if (scrollRef.current && currentSymbol && currentSymbol !== centerSymbol) {
            const index = watchlist.indexOf(currentSymbol);
            if (index !== -1) {
                const container = scrollRef.current;
                setTimeout(() => {
                    const item = container.children[index] as HTMLElement;
                    if (item) {
                        const targetScroll = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                        container.scrollTo({ left: targetScroll, behavior: 'smooth' });
                    }
                }, 100);
            }
        }
    }, [currentSymbol, watchlist]);

    return (
        <div
            className={cn(
                "relative w-full h-10 bg-transparent flex flex-col justify-center transition-all duration-300",
                isDimmed ? "opacity-10 scale-95 pointer-events-none" : "opacity-100 scale-100"
            )}
        >
            {/* Horizontal Scroll Wheel */}
            <div
                ref={scrollRef}
                className="flex items-center h-full overflow-x-auto no-scrollbar scroll-smooth touch-pan-x"
                style={{
                    scrollSnapType: 'x mandatory',
                    paddingLeft: 'calc(50% - 40px)',
                    paddingRight: 'calc(50% - 40px)'
                }}
            >
                {watchlist.map((symbol) => {
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
                            key={symbol}
                            data-symbol={symbol}
                            className="flex-shrink-0 w-20 flex items-center justify-center transition-all duration-300 select-none py-1 gap-1.5 active:scale-95"
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isActive) {
                                    if (window.navigator.vibrate) window.navigator.vibrate(10);
                                    onSymbolTap?.();
                                    return;
                                }
                                const container = scrollRef.current;
                                if (container) {
                                    const index = watchlist.indexOf(symbol);
                                    const item = container.children[index] as HTMLElement;
                                    const targetScroll = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                                    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
                                }
                            }}
                        >
                            <div className={cn(
                                "w-4 h-4 rounded-full overflow-hidden bg-white/5 flex items-center justify-center border border-white/10 shrink-0 transition-transform duration-300",
                                isActive && "border-blue-500 scale-110 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                            )}>
                                <img
                                    src={logoUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const parent = (e.target as HTMLImageElement).parentElement;
                                        if (parent) parent.innerHTML = `<span class="text-[7px] font-bold text-zinc-500">${symbol[0]}</span>`;
                                    }}
                                />
                            </div>
                            <span className={cn(
                                "text-[12px] font-bold uppercase tracking-tight transition-colors duration-300",
                                isActive ? "text-white" : "text-zinc-600"
                            )}>
                                {symbol}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Selection Highlight Overlays */}
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-zinc-950/20 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-zinc-950/20 to-transparent pointer-events-none z-10" />

            {/* Center Marker */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0.5 w-4 h-0.5 bg-blue-500/50 rounded-full pointer-events-none z-20" />
        </div>
    );
}
