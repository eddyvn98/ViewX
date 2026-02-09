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

    if (!symbol || !interval || !source || !candles.length) return null;

    return (
        <div
            ref={containerRef}
            className="absolute left-1.5 top-12 z-[40] pointer-events-none select-none flex flex-col gap-1 items-start"
        >
            {/* Main Info Card - Vacuum Packed */}
            <div
                data-legend-container
                className="flex flex-col gap-1 p-1.5 backdrop-blur-xl border rounded-lg shadow-2xl w-fit bg-zinc-950/80 border-white/10"
            >
                {/* Status Column */}
                <div className="flex flex-col gap-0.5 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1.5 px-0.5">
                        <div data-status="dot" className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span data-status="text" className="text-[9px] font-bold text-green-500 uppercase">Live</span>
                    </div>

                    {/* Compact OHLC */}
                    <div className="flex flex-col gap-0 px-0.5 mt-0.5">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold text-white/20">O</span>
                            <span data-ohlc="open" className="text-[12px] font-mono font-semibold text-white/90">···</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold text-white/20">H</span>
                            <span data-ohlc="high" className="text-[12px] font-mono font-semibold text-white/90">···</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold text-white/20">L</span>
                            <span data-ohlc="low" className="text-[12px] font-mono font-semibold text-white/90">···</span>
                        </div>
                    </div>
                </div>

                {/* Price Box */}
                <div className="flex flex-col gap-0 px-0.5 pt-0.5">
                    <span data-ohlc="close" className="text-[15px] font-mono font-bold text-white leading-tight">···</span>
                    <div className="flex items-center gap-1.5">
                        <span data-ohlc="change" className="text-[10px] font-mono font-bold">···</span>
                        <span data-ohlc="change-percent" className="text-[9px] font-mono font-medium opacity-40">···</span>
                    </div>
                </div>
            </div>

            {/* Indicators - Tight List */}
            <div
                data-indicators
                className="flex flex-col gap-0.5 p-1 backdrop-blur-lg border rounded-lg bg-zinc-950/50 border-white/5 w-fit"
            >
                {indicators.map((ind: any) => (
                    <div
                        key={ind.id}
                        data-indicator-id={ind.id}
                        className="flex flex-col px-1"
                    >
                        <span className="text-[8px] font-bold text-white/20 uppercase tracking-tighter">
                            {ind.type === 'MACD' ? 'MACD' : `${ind.type} ${ind.params?.period || 14}`}
                        </span>
                        <div data-indicator-value className="flex gap-1.5 font-mono text-[11px] font-bold leading-none">
                            {ind.type === 'MACD' ? (
                                <>
                                    <span style={{ color: ind.color }}>···</span>
                                    <span style={{ color: '#FF6D00' }}>···</span>
                                    <span>···</span>
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
