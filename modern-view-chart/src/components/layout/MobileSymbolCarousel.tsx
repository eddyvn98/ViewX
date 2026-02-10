'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function MobileSymbolCarousel() {
    const watchlist = useMarketStore(state => state.watchlist);
    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeTab = useMarketStore(state => state.tabs[activeTabId]);
    const tickers = useMarketStore(state => state.tickers);
    const setChartSymbol = useMarketStore(state => state.setChartSymbol);
    const setChartTimeframe = useMarketStore(state => state.setChartTimeframe);

    const activeChartId = activeTab?.activeChartId || 'default';
    const currentSymbol = activeTab?.charts[activeChartId]?.symbol;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [centerSymbol, setCenterSymbol] = useState(currentSymbol);
    const lastEmittedSymbol = useRef(currentSymbol);

    // Long Press State
    const [longPressTarget, setLongPressTarget] = useState<{ symbol: string; chartId: string } | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const pressCoords = useRef<{ x: number, y: number } | null>(null);
    const isLongPressing = useRef(false);

    const timeframes = ['1', '5', '15', '60', '240', 'D'];

    const handlePressStart = (e: React.PointerEvent, symbol: string) => {
        isLongPressing.current = false;
        pressCoords.current = { x: e.clientX, y: e.clientY };
        longPressTimer.current = setTimeout(() => {
            isLongPressing.current = true;
            setLongPressTarget({ symbol, chartId: activeChartId });
            if (window.navigator.vibrate) window.navigator.vibrate(50);
        }, 600);
    };

    const handlePressMove = (e: React.PointerEvent, symbol: string) => {
        if (pressCoords.current) {
            const deltaX = Math.abs(e.clientX - pressCoords.current.x);
            const deltaY = pressCoords.current.y - e.clientY; // Positive = swipe up

            // If user swipes up more than 30px, open TF menu
            if (deltaY > 30 && !longPressTarget) {
                setLongPressTarget({ symbol, chartId: activeChartId });
                if (window.navigator.vibrate) window.navigator.vibrate(50);
                handlePressEnd();
                return;
            }

            if (deltaX > 10 || Math.abs(deltaY) > 10) {
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
            }
        }
    };

    const handlePressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        pressCoords.current = null;
    };

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
            className="relative w-full h-10 bg-transparent flex flex-col justify-center"
            onClick={() => longPressTarget && setLongPressTarget(null)}
        >
            {/* Horizontal Scroll Wheel */}
            <div
                ref={scrollRef}
                className={cn(
                    "flex items-center h-full overflow-x-auto no-scrollbar scroll-smooth transition-all",
                    longPressTarget ? "overflow-hidden touch-none opacity-20 scale-95" : "touch-pan-x"
                )}
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
                            className="flex-shrink-0 w-20 flex items-center justify-center transition-all duration-300 select-none py-1 gap-1.5"
                            style={{ scrollSnapAlign: 'center' }}
                            onContextMenu={(e) => e.preventDefault()}
                            onPointerDown={(e) => handlePressStart(e, symbol)}
                            onPointerMove={(e) => handlePressMove(e, symbol)}
                            onPointerUp={handlePressEnd}
                            onPointerLeave={handlePressEnd}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (longPressTarget) {
                                    setLongPressTarget(null);
                                    return;
                                }
                                if (isActive && !isLongPressing.current) {
                                    setLongPressTarget({ symbol, chartId: activeChartId });
                                    if (window.navigator.vibrate) window.navigator.vibrate(50);
                                    return;
                                }
                                if (isLongPressing.current) return;
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

            {/* Timeframe Selector - Floating ABOVE the row */}
            {longPressTarget && (
                <div
                    className="absolute bottom-full left-0 right-0 z-[60] flex items-center justify-center p-2 mb-1 animate-in slide-in-from-bottom-2 zoom-in-95 fade-in duration-200"
                    onClick={() => setLongPressTarget(null)}
                >
                    <div
                        className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-xl p-1 flex items-stretch gap-1 shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-3 py-1 border-r border-white/5 flex flex-col justify-center bg-white/5 rounded-l-lg">
                            <span className="text-[11px] font-black text-white leading-none uppercase">{longPressTarget.symbol}</span>
                        </div>
                        <div className="flex items-center gap-0.5 px-0.5">
                            {timeframes.map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => {
                                        setChartTimeframe(longPressTarget.chartId, tf);
                                        setLongPressTarget(null);
                                    }}
                                    className="w-9 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-zinc-400 active:bg-blue-600 active:text-white transition-all hover:text-white active:scale-90"
                                >
                                    {tf === '60' ? '1H' : tf === '240' ? '4H' : tf + (tf === 'D' ? '' : 'm')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Highlight Overlays */}
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-zinc-950/20 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-zinc-950/20 to-transparent pointer-events-none z-10" />

            {/* Center Marker */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0.5 w-4 h-0.5 bg-blue-500/50 rounded-full pointer-events-none z-20" />
        </div>
    );
}
