'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { SymbolIcon } from '@/features/chart/components/SymbolIcon';

interface MobileSymbolCarouselProps {
    onSymbolTap?: () => void;
    onSymbolLongPress?: () => void;
    isDimmed?: boolean;
}

export const MobileSymbolCarousel = React.memo(function MobileSymbolCarousel({ onSymbolTap, onSymbolLongPress, isDimmed = false }: MobileSymbolCarouselProps) {
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
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggeredRef = useRef(false);
    const pressStartRef = useRef({ x: 0, y: 0 });

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

            const firstSetItem = items[0] as HTMLElement;
            const secondSetItem = items[watchlist.length] as HTMLElement;

            if (firstSetItem && secondSetItem) {
                const singleSetWidth = secondSetItem.offsetLeft - firstSetItem.offsetLeft;

                if (container.scrollLeft < 10) {
                    container.scrollLeft += singleSetWidth;
                } else if (container.scrollLeft > container.scrollWidth - container.clientWidth - 10) {
                    container.scrollLeft -= singleSetWidth;
                }
            }

            for (let i = 0; i < items.length; i++) {
                const item = items[i] as HTMLElement;
                const itemCenter = item.offsetLeft + item.clientWidth / 2;
                const distance = Math.abs(itemCenter - center);

                const normalizedDistance = Math.min(distance / 120, 1);
                const scale = 1.25 - (normalizedDistance * 0.25);

                item.style.opacity = `${1 - normalizedDistance * 0.5}`;
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

        const onScroll = () => requestAnimationFrame(updateVisuals);
        container.addEventListener('scroll', onScroll);
        updateVisuals();
        return () => container.removeEventListener('scroll', onScroll);
    }, [centerSymbol, watchlist]);

    useEffect(() => {
        if (centerSymbol && centerSymbol !== lastEmittedSymbol.current && initialCentered.current) {
            const timer = setTimeout(() => {
                setChartSymbol(activeChartId, centerSymbol);
                lastEmittedSymbol.current = centerSymbol;
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [centerSymbol, activeChartId, setChartSymbol]);

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

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        };
    }, []);

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

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
                    const isActive = centerSymbol === symbol;

                    return (
                        <div
                            key={`${symbol}-${idx}`}
                            data-symbol={symbol}
                            className="flex-shrink-0 w-auto px-2 flex items-center justify-center select-none"
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (longPressTriggeredRef.current) {
                                    longPressTriggeredRef.current = false;
                                    return;
                                }
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
                            onTouchStart={(e) => {
                                if (!isActive) return;
                                const touch = e.touches[0];
                                if (!touch) return;
                                longPressTriggeredRef.current = false;
                                pressStartRef.current = { x: touch.clientX, y: touch.clientY };
                                clearLongPress();
                                longPressTimerRef.current = setTimeout(() => {
                                    longPressTriggeredRef.current = true;
                                    if (window.navigator.vibrate) window.navigator.vibrate(12);
                                    onSymbolLongPress?.();
                                }, 450);
                            }}
                            onTouchMove={(e) => {
                                const touch = e.touches[0];
                                if (!touch) return;
                                const dx = Math.abs(touch.clientX - pressStartRef.current.x);
                                const dy = Math.abs(touch.clientY - pressStartRef.current.y);
                                if (dx > 10 || dy > 10) {
                                    clearLongPress();
                                }
                            }}
                            onTouchEnd={() => {
                                clearLongPress();
                            }}
                            onTouchCancel={() => {
                                clearLongPress();
                            }}
                        >
                            <div className={cn(
                                "flex flex-row items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 border",
                                isActive
                                    ? "bg-primary/20 border-primary/20 text-foreground shadow-[0_0_15px_var(--glow-primary)]"
                                    : "bg-transparent border-transparent text-muted-foreground"
                            )}>
                                <div className={cn(
                                    "w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0",
                                    isActive && "scale-110"
                                )}>
                                    <SymbolIcon symbol={symbol} className="w-full h-full" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                                )}>
                                    {symbol}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        </div>
    );
});
