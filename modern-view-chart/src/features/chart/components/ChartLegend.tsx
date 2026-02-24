'use client';

import React, { useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useLegendDOMUpdater } from '../hooks/use-legend-dom-updater';
import { useShallow } from 'zustand/react/shallow';
import { SymbolIcon } from './SymbolIcon';

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

    // Get indicators config (stable, rarely changes)
    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || EMPTY_INDICATORS).filter((i: any) => i.visible && i.pane !== 'subchart')
    ));

    // DOM-based updates - NO REACT RE-RENDERS on hover!
    useLegendDOMUpdater(containerRef, { chartId, symbol, interval, source, candles, chartType });

    const isDataMissing = !symbol || !interval || !source || !candles.length;

    return (
        <div
            ref={containerRef}
            className={`absolute left-2 top-[38px] z-[40] pointer-events-none select-none flex flex-col gap-1.5 items-start transition-opacity duration-300 ${isDataMissing ? 'opacity-0' : 'opacity-100'}`}
        >
            {/* Main Info Card - Unified DNA */}
            <div
                data-legend-container
                className="flex flex-col gap-1.5 p-1.5 md:backdrop-blur-xl md:border rounded-xl md:shadow-sm w-[114px] bg-transparent border-none md:bg-primary/5 md:border-primary/10 transition-colors duration-300"
            >
                {/* Status Column */}
                <div className="flex items-center justify-between pb-1 border-b border-border/10">
                    <div className="flex items-center gap-2 px-0.5">
                        <div data-status="dot" className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span data-status="text" className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Live</span>
                    </div>
                    {symbol && (
                        <SymbolIcon symbol={symbol} className="w-3.5 h-3.5" />
                    )}
                </div>

                {/* Elegant OHLC Rows */}
                <div className="flex flex-col gap-0.5 px-0.5 font-bold">
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-muted-foreground/30 min-w-[7px]">O</span>
                        <span data-ohlc="open" className="text-[11px] text-foreground tracking-tight">---</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-muted-foreground/30 min-w-[7px]">H</span>
                        <span data-ohlc="high" className="text-[11px] text-foreground tracking-tight">---</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-muted-foreground/30 min-w-[7px]">L</span>
                        <span data-ohlc="low" className="text-[11px] text-foreground tracking-tight">---</span>
                    </div>
                </div>

                {/* Elegant Price Display */}
                <div className="flex flex-col pt-1.5 border-t border-border/10">
                    <span data-ohlc="close" className="text-[15px] font-bold text-foreground leading-tight">···</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span data-ohlc="change" className="text-[11px] font-bold">···</span>
                        <span data-ohlc="change-percent" className="text-[11px] font-bold opacity-70">···</span>
                    </div>
                </div>
            </div>

            {/* Indicators - Refined List */}
            <div
                data-indicators
                className="flex flex-col gap-1 px-1 w-[114px]"
            >
                {indicators.map((ind: any) => (
                    <div
                        key={ind.id}
                        data-indicator-id={ind.id}
                        className="flex flex-col"
                    >
                        <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-tighter leading-none mb-0.5">
                            {ind.type === 'MACD' ? 'MACD' : `${ind.type} ${ind.params?.period || 14}`}
                        </span>
                        <div data-indicator-value className="flex gap-1 text-[11px] font-bold leading-none">
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
    );
}
