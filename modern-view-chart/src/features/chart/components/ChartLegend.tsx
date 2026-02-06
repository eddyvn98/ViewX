'use client';

import React from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useChartIndicatorValues } from '../hooks/use-chart-indicator-values';
import { cn } from '@/lib/utils';

interface ChartLegendProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

export function ChartLegend({ chartId, symbol, interval, source, candles }: ChartLegendProps) {
    const ohlcData = useChartOHLC(symbol, interval, source);
    const activeIndex = ohlcData?.activeIndex ?? -1;
    const indicators = useChartIndicatorValues(chartId, candles, activeIndex, ohlcData?.close);
    const crosshairPoint = useMarketStore(state => state.crosshairPoint);
    const isHovering = !!(crosshairPoint?.time && crosshairPoint?.sourceId === chartId);

    // VITAL: Early return must happen AFTER all hooks are called
    if (!ohlcData) return null;

    const { open: o, high: h, low: l, close: c, changeValue, change } = ohlcData;
    const isPositive = changeValue >= 0;
    const color = isPositive ? '#22c55e' : '#ef4444';

    const formatPrice = (p: number) => {
        if (p === 0) return '0.00';
        if (p < 0.0001) return p.toExponential(4);
        if (p < 1) return p.toFixed(5);
        if (p < 100) return p.toFixed(3);
        return p.toFixed(2);
    };

    return (
        <div className="absolute left-1 top-2 z-[40] pointer-events-none select-none flex flex-col gap-1.5 items-start">
            {/* Status & Price Cluster - Acts as Data Window when hovering */}
            <div
                className={cn(
                    "flex flex-col gap-1.5 p-2 backdrop-blur-md border rounded-lg shadow-xl min-w-[130px] transition-colors duration-200",
                    isHovering
                        ? "bg-amber-500/10 border-amber-500/40"
                        : "bg-zinc-950/60 border-white/5"
                )}
            >
                {/* Status Tag */}
                <div className={cn(
                    "flex items-center justify-between gap-3 px-1 pb-1 border-b mb-0.5",
                    isHovering ? "border-amber-500/20" : "border-white/5"
                )}>
                    {isHovering ? (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]" />
                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest italic">Historical</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)] animate-pulse" />
                            <span className="text-[8px] font-black text-green-500 uppercase tracking-widest opacity-80">Live</span>
                        </div>
                    )}
                    <span className={cn(
                        "text-[8px] font-bold whitespace-nowrap",
                        isHovering ? "text-amber-500/40" : "text-white/20"
                    )}>{symbol}</span>
                </div>

                {/* OHLC Vertical List */}
                <div className="flex flex-col gap-0.5 px-1">
                    <div className="flex items-center justify-between">
                        <span className={cn("text-[8px] font-bold uppercase", isHovering ? "text-white/40" : "text-white/20")}>Open</span>
                        <span className="text-[10px] font-mono text-white/70">{formatPrice(o)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className={cn("text-[8px] font-bold uppercase", isHovering ? "text-white/40" : "text-white/20")}>High</span>
                        <span className="text-[10px] font-mono text-white/70">{formatPrice(h)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className={cn("text-[8px] font-bold uppercase", isHovering ? "text-white/40" : "text-white/20")}>Low</span>
                        <span className="text-[10px] font-mono text-white/70">{formatPrice(l)}</span>
                    </div>
                </div>

                {/* Close & Change Highlight Box */}
                <div className={cn(
                    "flex items-center justify-between gap-4 px-2 py-1.5 mt-0.5 rounded-md border",
                    isHovering ? "bg-amber-500/10 border-amber-500/20" : "bg-white/5 border-white/5"
                )}>
                    <span className="text-[11px] font-mono font-black" style={{ color }}>{formatPrice(c)}</span>
                    <span className="text-[9px] font-mono font-bold" style={{ color }}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Indicators Section - Individual Tags */}
            <div className="flex flex-col gap-1">
                {indicators.filter(ind => ind.pane !== 'subchart').map((ind) => (
                    <div
                        key={ind.id}
                        className={cn(
                            "flex flex-col gap-0.5 px-2 py-1 backdrop-blur-sm border rounded-md shadow-sm w-fit transition-colors duration-200",
                            isHovering
                                ? "bg-amber-500/5 border-amber-500/20"
                                : "bg-zinc-950/40 border-white/5"
                        )}
                    >
                        <span className={cn(
                            "text-[7px] font-black uppercase tracking-tighter italic truncate",
                            isHovering ? "text-white/40" : "text-white/20"
                        )}>
                            {ind.name}
                        </span>
                        <div className="flex flex-wrap gap-x-1.5 leading-none">
                            {ind.values ? (
                                ind.values.map((v, i) => (
                                    <span key={i} className="text-[9px] font-mono font-bold" style={{ color: v.color }}>
                                        {v.value}
                                    </span>
                                ))
                            ) : (
                                <span className="text-[9px] font-mono font-bold" style={{ color: ind.color as string }}>
                                    {ind.value}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
