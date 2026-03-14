import React from 'react';
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
    isMinimized,
    mainContainerRef,
    priceContainerRef,
    subchartContainerRef,
    timescaleContainerRef,
    children
}: ChartPanelsProps) {
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
                    <div ref={priceContainerRef} className="w-full h-full touch-none" />
                </div>

                {children}

                <div
                    className={cn(
                        "absolute right-[50px] md:right-[62px] z-30 flex items-end transition-all duration-300",
                        isMinimized && isSubchartVisible ? "bottom-[32px]" : (isSubchartVisible ? "bottom-[25%]" : "bottom-0")
                    )}
                >
                    <SubchartIndicatorsTabs
                        chartId={chartId}
                        isSubchartVisible={isSubchartVisible}
                    />

                    <button
                        onClick={() => setIsSubchartVisible(!isSubchartVisible)}
                        className={cn(
                            "px-3 md:px-4 py-1 rounded-tr-md border border-border border-b-0 border-l-0 transition-all active:scale-95 flex items-center gap-1.5 backdrop-blur-md",
                            isSubchartVisible
                                ? "bg-secondary/80 text-muted-foreground hover:text-primary"
                                : "bg-primary/20 text-primary font-bold"
                        )}
                        style={{ marginLeft: '-1px' }}
                    >
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tight md:tracking-widest whitespace-nowrap">
                            {isSubchartVisible ? 'Hide' : (
                                <>
                                    <span className="md:inline hidden">Show Indicator</span>
                                    <span className="md:hidden inline">Show</span>
                                </>
                            )}
                        </span>
                        {isSubchartVisible ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                </div>

                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 z-10 border-t border-primary/20 transition-all duration-300 transform overflow-hidden",
                        isSubchartVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none",
                        isMinimized && isSubchartVisible ? "h-[80px] bg-background/5 backdrop-blur-[1.5px]" : "h-[25%] min-h-[100px] bg-background/5 backdrop-blur-[1.5px]"
                    )}
                >

                    <div className="absolute left-3 top-[5%] z-10 pointer-events-none select-none">
                        <SubchartLegend
                            chartId={chartId}
                            symbol={symbol}
                            interval={interval}
                            source={source}
                            candles={candles}
                        />
                    </div>

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
