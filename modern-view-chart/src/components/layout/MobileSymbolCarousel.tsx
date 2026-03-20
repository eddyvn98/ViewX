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

    const resolvedActiveChartId = (() => {
        if (!activeTab) return null;
        if (activeTab.activeChartId && activeTab.charts[activeTab.activeChartId]) return activeTab.activeChartId;
        const fallbackChartId = Object.keys(activeTab.charts || {})[0];
        return fallbackChartId || null;
    })();
    const currentSymbol = resolvedActiveChartId ? activeTab?.charts[resolvedActiveChartId]?.symbol : undefined;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [centerSymbol, setCenterSymbol] = useState(currentSymbol);
    const initialCentered = useRef(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggeredRef = useRef(false);
    const dragMovedRef = useRef(false);
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
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        };
    }, []);

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    useEffect(() => {
        if (!initialCentered.current) return;
        if (!centerSymbol || !currentSymbol || centerSymbol === currentSymbol) return;
        if (!resolvedActiveChartId) return;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
            setChartSymbol(resolvedActiveChartId, centerSymbol);
        }, 220);
        return () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        };
    }, [centerSymbol, currentSymbol, resolvedActiveChartId, setChartSymbol]);

    const startLongPress = (x: number, y: number) => {
        longPressTriggeredRef.current = false;
        pressStartRef.current = { x, y };
        clearLongPress();
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            if (window.navigator.vibrate) window.navigator.vibrate(12);
            onSymbolLongPress?.();
        }, 450);
    };

    const moveLongPress = (x: number, y: number) => {
        const dx = Math.abs(x - pressStartRef.current.x);
        const dy = Math.abs(y - pressStartRef.current.y);
        if (dx > 10 || dy > 10) {
            dragMovedRef.current = true;
            clearLongPress();
        }
    };

    const selectSymbol = (symbol: string, element: HTMLElement) => {
        if (symbol === centerSymbol) {
            if (window.navigator.vibrate) window.navigator.vibrate(10);
            onSymbolTap?.();
            return;
        }
        setCenterSymbol(symbol);
        if (resolvedActiveChartId) {
            setChartSymbol(resolvedActiveChartId, symbol);
        }
        const container = scrollRef.current;
        if (container) {
            const targetScroll = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
            container.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
    };

    return (
        <div
            className={cn(
                "relative w-full h-full bg-transparent flex items-center justify-center transition-all duration-300",
                isDimmed ? "opacity-10 scale-95 pointer-events-none" : "opacity-100 scale-100"
            )}
            data-testid="mobile-symbol-carousel"
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
                            data-testid={`mobile-symbol-${symbol}`}
                            className="flex-shrink-0 w-auto px-2 flex items-center justify-center select-none"
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (longPressTriggeredRef.current) {
                                    longPressTriggeredRef.current = false;
                                    return;
                                }
                                selectSymbol(symbol, e.currentTarget);
                            }}
                            onTouchStart={(e) => {
                                const touch = e.touches[0];
                                if (!touch) return;
                                dragMovedRef.current = false;
                                startLongPress(touch.clientX, touch.clientY);
                            }}
                            onTouchMove={(e) => {
                                const touch = e.touches[0];
                                if (!touch) return;
                                moveLongPress(touch.clientX, touch.clientY);
                            }}
                            onTouchEnd={(e) => {
                                if (!dragMovedRef.current && !longPressTriggeredRef.current) {
                                    selectSymbol(symbol, e.currentTarget);
                                }
                                clearLongPress();
                            }}
                            onTouchCancel={() => {
                                clearLongPress();
                            }}
                            onPointerDown={(e) => {
                                startLongPress(e.clientX, e.clientY);
                            }}
                            onPointerMove={(e) => {
                                moveLongPress(e.clientX, e.clientY);
                            }}
                            onPointerUp={() => {
                                clearLongPress();
                            }}
                            onPointerCancel={() => {
                                clearLongPress();
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                longPressTriggeredRef.current = true;
                                onSymbolLongPress?.();
                            }}
                            onMouseDown={(e) => {
                                startLongPress(e.clientX, e.clientY);
                            }}
                            onMouseMove={(e) => {
                                moveLongPress(e.clientX, e.clientY);
                            }}
                            onMouseUp={() => {
                                clearLongPress();
                            }}
                            onMouseLeave={() => {
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
                                    "text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
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
