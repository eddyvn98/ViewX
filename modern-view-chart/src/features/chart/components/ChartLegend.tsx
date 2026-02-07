'use client';

import React, { useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useLegendDOMUpdater } from '../hooks/use-legend-dom-updater';
import { useShallow } from 'zustand/react/shallow';

interface ChartLegendProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
    priceChart?: import('lightweight-charts').IChartApi | null;
    series?: import('lightweight-charts').ISeriesApi<"Candlestick"> | null;
}

const EMPTY_INDICATORS: any[] = [];

export function ChartLegend({ chartId, symbol, interval, source, candles }: ChartLegendProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Get indicators config (stable, rarely changes)
    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || EMPTY_INDICATORS).filter((i: any) => i.visible && i.pane !== 'subchart')
    ));

    // DOM-based updates - NO REACT RE-RENDERS on hover!
    useLegendDOMUpdater(containerRef, { chartId, symbol, interval, source, candles });

    if (!symbol || !interval || !source || !candles.length) return null;

    return (
        <div
            ref={containerRef}
            className="absolute left-1 top-2 z-[40] pointer-events-none select-none flex flex-col gap-1.5 items-start"
        >
            {/* OHLC Container - Updated via DOM manipulation */}
            <div
                data-legend-container
                className="flex flex-col gap-1.5 p-2 backdrop-blur-md border rounded-lg shadow-xl min-w-fit transition-colors duration-200 bg-zinc-950/60 border-white/5"
            >
                {/* Status Tag */}
                <div className="flex items-center justify-between gap-3 px-1 pb-1 border-b border-white/5 mb-0.5">
                    <div className="flex items-center gap-1.5">
                        <div
                            data-status="dot"
                            className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)] animate-pulse"
                        />
                        <span
                            data-status="text"
                            className="text-[8px] font-black text-green-500 uppercase tracking-widest opacity-80"
                        >
                            Live
                        </span>
                    </div>
                    <span className="text-[8px] font-bold whitespace-nowrap text-white/20">{symbol}</span>
                </div>

                {/* OHLC Vertical List */}
                <div className="flex flex-col gap-0.5 px-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase text-white/20">Open</span>
                        <span data-ohlc="open" className="text-[10px] font-mono text-white/70">···</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase text-white/20">High</span>
                        <span data-ohlc="high" className="text-[10px] font-mono text-white/70">···</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase text-white/20">Low</span>
                        <span data-ohlc="low" className="text-[10px] font-mono text-white/70">···</span>
                    </div>
                </div>

                {/* Close & Change Highlight Box */}
                <div className="flex flex-col items-start gap-0 px-2 py-1 mt-0.5 rounded-md border bg-white/5 border-white/5 w-full">
                    <span data-ohlc="close" className="text-[11px] font-mono font-black leading-tight">···</span>
                    <div className="flex items-center gap-1.5 leading-none mt-0.5">
                        <span data-ohlc="change" className="text-[8px] font-mono font-bold">···</span>
                        <span data-ohlc="change-percent" className="text-[8px] font-mono font-bold opacity-80">···</span>
                    </div>
                </div>
            </div>

            {/* Indicators Section - Static structure, values updated via DOM */}
            <div data-indicators className="flex flex-col gap-1">
                {indicators.map((ind: any) => (
                    <div
                        key={ind.id}
                        data-indicator-id={ind.id}
                        className="flex flex-col gap-0.5 px-2 py-1 backdrop-blur-sm border rounded-md shadow-sm w-fit transition-colors duration-200 bg-zinc-950/40 border-white/5"
                    >
                        <span className="text-[7px] font-black uppercase tracking-tighter italic truncate text-white/20">
                            {ind.type === 'MACD' ? 'MACD' : `${ind.type} ${ind.params?.period || 14}`}
                        </span>
                        <div data-indicator-value className="flex flex-wrap gap-x-1.5 leading-none">
                            {ind.type === 'MACD' ? (
                                <>
                                    <span className="text-[9px] font-mono font-bold" style={{ color: ind.color }}>···</span>
                                    <span className="text-[9px] font-mono font-bold" style={{ color: '#FF6D00' }}>···</span>
                                    <span className="text-[9px] font-mono font-bold">···</span>
                                </>
                            ) : (
                                <span className="text-[9px] font-mono font-bold" style={{ color: ind.color }}>···</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
