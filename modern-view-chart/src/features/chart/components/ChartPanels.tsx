import React, { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SubchartIndicatorsTabs } from './SubchartIndicatorsTabs';
import { SubchartLegend } from './SubchartLegend';
import { Candle } from '@/lib/store';
import { CursorTooltip } from './CursorTooltip';

interface ChartPanelsProps {
    chartId: string;
    symbol?: string;
    interval?: string;
    source?: string;
    candles: Candle[];
    isSubchartVisible: boolean;
    setIsSubchartVisible: (visible: boolean) => void;
    subchartHeightPct: number;
    setSubchartHeightPct: (heightPct: number) => void;
    resetSubchartHeightPct: () => void;
    isMinimized: boolean;
    mainContainerRef: React.RefObject<HTMLDivElement | null>;
    priceContainerRef: React.RefObject<HTMLDivElement | null>;
    subchartContainerRef: React.RefObject<HTMLDivElement | null>;
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>;
    children: React.ReactNode;
}

export function ChartPanels({
    chartId,
    symbol,
    interval,
    source,
    candles,
    isSubchartVisible,
    setIsSubchartVisible,
    subchartHeightPct,
    setSubchartHeightPct,
    resetSubchartHeightPct,
    isMinimized,
    mainContainerRef,
    priceContainerRef,
    subchartContainerRef,
    timescaleContainerRef,
    children
}: ChartPanelsProps) {
    const isDraggingRef = useRef(false);
    const lastPointerDownAtRef = useRef(0);
    const [isCompactLandscape, setIsCompactLandscape] = React.useState(false);

    React.useEffect(() => {
        const updateCompactMode = () => {
            if (typeof window === 'undefined') return;
            const isLandscape = window.innerWidth > window.innerHeight;
            const isShortViewport = window.innerHeight <= 500;
            setIsCompactLandscape(Boolean(isLandscape && isShortViewport));
        };

        updateCompactMode();
        window.addEventListener('resize', updateCompactMode);
        window.addEventListener('orientationchange', updateCompactMode);
        return () => {
            window.removeEventListener('resize', updateCompactMode);
            window.removeEventListener('orientationchange', updateCompactMode);
        };
    }, []);

    const startResizeSubchart = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (isMinimized || !isSubchartVisible) return;
        const now = Date.now();
        if (now - lastPointerDownAtRef.current <= 500) {
            lastPointerDownAtRef.current = 0;
            resetSubchartHeightPct();
            return;
        }
        lastPointerDownAtRef.current = now;

        const container = mainContainerRef.current;
        if (!container) return;

        const pointerId = event.pointerId;
        event.currentTarget.setPointerCapture(pointerId);
        isDraggingRef.current = true;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';

        const clamp = (value: number) => Math.max(0, Math.min(85, value));

        const updateHeight = (clientY: number) => {
            const rect = container.getBoundingClientRect();
            const pixelsFromBottom = rect.bottom - clientY;
            const nextPct = clamp((pixelsFromBottom / Math.max(1, rect.height)) * 100);
            if (nextPct <= 2) {
                setIsSubchartVisible(false);
                return;
            }
            setSubchartHeightPct(nextPct);
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (!isDraggingRef.current) return;
            updateHeight(moveEvent.clientY);
        };

        const endDrag = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
    }, [isMinimized, isSubchartVisible, mainContainerRef, resetSubchartHeightPct, setIsSubchartVisible, setSubchartHeightPct]);

    const activeSubchartHeightPct = Math.max(3, Math.min(85, subchartHeightPct || 25));
    const subchartBottomOffset = isMinimized && isSubchartVisible ? '32px' : (isSubchartVisible ? `${activeSubchartHeightPct}%` : '0px');
    const subchartHeightStyle = isMinimized && isSubchartVisible ? '80px' : `${activeSubchartHeightPct}%`;

    return (
        <>
            <div ref={mainContainerRef} className="flex-1 relative min-h-0 touch-none">
                {/* Outer wrapper controls absolute positioning; inner div is given to
                    lightweight-charts which forces position:relative on whatever it mounts into.
                    Keeping them separate prevents the library from collapsing our layout. */}
                <div
                    className={cn(
                        "absolute top-0 left-0 right-0 bottom-0"
                    )}
                >
                    <div ref={priceContainerRef} data-testid={`chart-price-${chartId}`} className="w-full h-full touch-none" />
                </div>

                {children}

                <div
                    className={cn(
                        "absolute right-[50px] md:right-[62px] z-30 flex items-end transition-all duration-300",
                        isSubchartVisible ? "" : "bottom-0"
                    )}
                    style={isSubchartVisible ? { bottom: subchartBottomOffset } : undefined}
                >
                    <SubchartIndicatorsTabs
                        chartId={chartId}
                        isSubchartVisible={isSubchartVisible}
                    />

                    <button
                        onClick={() => setIsSubchartVisible(!isSubchartVisible)}
                        className={cn(
                            "px-3 md:px-4 py-1 rounded-tr-md border border-border border-b-0 border-l-0 transition-all active:scale-95 flex items-center gap-1.5 backdrop-blur-md text-[11px] leading-none",
                            isCompactLandscape && "!px-2 !py-0.5 !gap-1 !text-[10px]",
                            isSubchartVisible
                                ? "bg-secondary/80 text-muted-foreground hover:text-primary"
                                : "bg-primary/20 text-primary font-bold"
                        )}
                        style={{ marginLeft: '-1px' }}
                    >
                        <span className={cn(
                            "text-[11px] md:text-[11px] font-black uppercase tracking-tight md:tracking-widest whitespace-nowrap",
                            isCompactLandscape && "!text-[10px] !tracking-tight"
                        )}>
                            {isSubchartVisible ? 'Hide' : (
                                <>
                                    <span className="md:inline hidden">Show Indicator</span>
                                    <span className="md:hidden inline">Show</span>
                                </>
                            )}
                        </span>
                        {isSubchartVisible ? <ChevronDown size={isCompactLandscape ? 10 : 12} /> : <ChevronUp size={isCompactLandscape ? 10 : 12} />}
                    </button>
                </div>

                <div className="absolute left-3 bottom-[42px] z-20 pointer-events-none select-none">
                    <SubchartLegend
                        chartId={chartId}
                        symbol={symbol}
                        interval={interval}
                        source={source}
                        candles={candles}
                        className="!relative !top-0 !left-0"
                    />
                </div>

                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 z-10 border-t border-primary/20 transition-all duration-300 transform overflow-hidden",
                        isSubchartVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none",
                        isMinimized && isSubchartVisible ? "bg-background/5 backdrop-blur-[1.5px]" : "bg-background/5 backdrop-blur-[1.5px]"
                    )}
                    style={{ height: subchartHeightStyle }}
                >
                    {!isMinimized && isSubchartVisible && (
                        <button
                            type="button"
                            aria-label="Resize subchart height"
                            onPointerDown={startResizeSubchart}
                            onDoubleClick={resetSubchartHeightPct}
                            className="absolute top-0 left-0 right-0 h-4 -translate-y-1/2 cursor-row-resize z-30 bg-transparent hover:bg-primary/15"
                            title="Double-click to reset subchart height"
                        />
                    )}

                    <div className="w-full h-full relative">
                        {/* Solid background for sub-chart price axis only - matches initialMinW (62) + extra for labels */}
                        <div className="absolute top-0 right-0 w-[68px] h-full bg-background z-[5] border-l border-primary/20" />

                        <div ref={subchartContainerRef} className="w-full h-full relative z-10 touch-none" />
                    </div>
                </div>
            </div>

            <div className="h-[1px] bg-border" />

            <div className="h-[38px] relative overflow-hidden shrink-0 bg-background/5 backdrop-blur-[1.5px] border-t border-border">
                <div ref={timescaleContainerRef} className="w-full h-full touch-none" />
            </div>

            <CursorTooltip
                chartId={chartId}
                symbol={symbol}
                interval={interval}
                source={source}
                candles={candles}
            />
        </>
    );
}
