'use client';

import React, { useRef, useState } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useLegendDOMUpdater } from '../hooks/use-legend-dom-updater';
import { useShallow } from 'zustand/react/shallow';
import { SymbolIcon } from './SymbolIcon';
import { isSmartAnalysis } from '../indicators/registry/indicator-categories';
import { SmartAnalysisToggles } from './SmartAnalysisToggles';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartLegendProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
    chartType?: string;
    priceChart?: import('lightweight-charts').IChartApi | null;
    series?: import('lightweight-charts').ISeriesApi<"Candlestick"> | null;
}

const EMPTY_INDICATORS: any[] = [];

export function ChartLegend({ chartId, symbol, interval, source, candles, chartType = 'candles' }: ChartLegendProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(true);

    // Get indicators config (stable, rarely changes)
    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || EMPTY_INDICATORS).filter((i: any) =>
            i.visible &&
            i.pane !== 'subchart' &&
            !isSmartAnalysis(i.type)
        )
    ));

    // DOM-based updates - NO REACT RE-RENDERS on hover!
    useLegendDOMUpdater(containerRef, { chartId, symbol, interval, source, candles, chartType });

    const isDataMissing = !symbol || !interval || !source || !candles.length;

    return (
        <div
            ref={containerRef}
            className={cn(
                "absolute left-2 right-0 top-2 md:top-[38px] md:right-auto z-[40] pointer-events-none select-none flex flex-col gap-1.5 items-start transition-opacity duration-300 opacity-100"
            )}
        >
            {/* Legend Toggle Button - Visible on Mobile */}
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="md:hidden absolute left-[140px] top-[-30px] z-[60] pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full bg-background/60 backdrop-blur-md border border-primary/20 text-muted-foreground hover:text-primary active:scale-95 transition-all shadow-lg"
            >
                {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            {/* Legend Content Wrapper */}
            <div className={cn(
                "flex flex-col gap-1.5 items-start transition-all duration-300 transform-gpu",
                isDataMissing && "opacity-0 pointer-events-none",
                !isVisible && "opacity-0 -translate-x-full pointer-events-none md:opacity-100 md:translate-x-0 md:pointer-events-none"
            )}>
                {/* Main Info Card - Unified DNA */}
                <div
                    data-legend-container
                    className="flex flex-col gap-1.5 p-2 md:border rounded-xl md:shadow-sm w-[132px] bg-transparent border-none md:bg-background/5 md:backdrop-blur-[1.5px] md:border-primary/25 subpixel-antialiased transition-colors duration-300"
                >
                    {/* Status Column */}
                    <div className="flex items-center justify-between pb-1 border-b border-border/10">
                        <div className="flex items-center gap-2 px-0.5">
                            <div data-status="dot" className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span data-status="text" className="text-[11px] font-extrabold text-emerald-500 uppercase tracking-wide">Live</span>
                        </div>
                        {symbol && (
                            <SymbolIcon symbol={symbol} className="w-3.5 h-3.5" />
                        )}
                    </div>

                    {/* Elegant OHLC Rows */}
                    <div className="flex flex-col gap-1 px-0.5 font-extrabold">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground/90 min-w-[8px]">O</span>
                            <span data-ohlc="open" className="text-[13px] text-foreground tracking-tight">---</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground/90 min-w-[8px]">H</span>
                            <span data-ohlc="high" className="text-[13px] text-foreground tracking-tight">---</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground/90 min-w-[8px]">L</span>
                            <span data-ohlc="low" className="text-[13px] text-foreground tracking-tight">---</span>
                        </div>
                    </div>

                    {/* Elegant Price Display */}
                    <div className="flex flex-col pt-1.5 border-t border-border/10">
                        <span data-ohlc="close" className="text-[17px] font-black text-foreground leading-tight">···</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span data-ohlc="change" className="text-[12px] font-extrabold">···</span>
                            <span data-ohlc="change-percent" className="text-[12px] font-extrabold opacity-100">···</span>
                        </div>
                    </div>
                </div>

                {/* Smart Analysis Tools Section */}
                <div className="w-[132px]">
                    <SmartAnalysisToggles chartId={chartId} />
                </div>

                {/* General Indicators List */}
                <div
                    data-indicators
                    className="flex flex-col gap-1 px-1.5 w-[132px] subpixel-antialiased"
                >
                    {indicators.map((ind: any) => (
                        <div
                            key={ind.id}
                            data-indicator-id={ind.id}
                            className="flex flex-col"
                        >
                            <span className="text-[10px] font-extrabold text-muted-foreground/95 uppercase tracking-tight leading-none mb-0.5">
                                {ind.type === 'MACD' ? 'MACD' : `${ind.type} ${ind.params?.period || 14}`}
                            </span>
                            <div data-indicator-value className="flex gap-1 text-[12px] font-extrabold leading-none">
                                {ind.type === 'MACD' ? (
                                    <>
                                        <span style={{ color: ind.color }}>···</span>
                                        <span style={{ color: '#FF6D00' }}>···</span>
                                        <span style={{ color: '#787b86' }}>···</span>
                                    </>
                                ) : (
                                    <span style={{ color: ind.color }}>···</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
