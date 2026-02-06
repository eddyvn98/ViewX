'use client';

import React, { useMemo } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useChartIndicatorValues } from '../hooks/use-chart-indicator-values';

interface DataWindowProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

export function DataWindow({ chartId, symbol, interval, source, candles }: DataWindowProps) {
    const crosshairPoint = useMarketStore(state => state.crosshairPoint);

    // Only show when hovering over a specific time/candle
    const isVisible = !!(crosshairPoint?.time && crosshairPoint?.sourceId === chartId);

    const ohlcData = useChartOHLC(symbol, interval, source);
    const activeIndex = ohlcData?.activeIndex ?? -1;

    // Get ALL indicators (both main and subchart)
    const indicators = useChartIndicatorValues(chartId, candles, activeIndex, ohlcData?.close);

    // Pinned position for stability - replaces the legend area
    const position = {
        top: '8px',
        left: '8px',
    };

    if (!isVisible || !ohlcData || !position) return null;

    const { open: o, high: h, low: l, close: c, isLive } = ohlcData;
    const diff = c - o;
    const diffPercent = (diff / o) * 100;
    const priceColor = diff >= 0 ? '#22c55e' : '#ef4444';

    return (
        <div
            className="absolute z-[150] pointer-events-none select-none bg-[#131722]/50 backdrop-blur-xl border border-white/10 rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-2.5 min-w-[200px] flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200"
            style={position as any}
        >
            {/* Header Area */}
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 px-0.5">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                        {symbol}
                    </span>
                    <span className="text-[10px] font-bold text-white/40">
                        {interval}
                    </span>
                </div>
            </div>

            {/* OHLC Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-0.5">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/30 font-bold">OPEN</span>
                    <span className="text-[10px] font-mono text-white/70">{o.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/30 font-bold">HIGH</span>
                    <span className="text-[10px] font-mono text-white/70">{h.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/30 font-bold">LOW</span>
                    <span className="text-[10px] font-mono text-white/70">{l.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/30 font-bold">CLOSE</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: priceColor }}>{c.toFixed(2)}</span>
                </div>
            </div>

            {/* Price Change & Info */}
            <div className="flex items-center justify-between bg-white/5 rounded px-2 py-1 mt-0.5">
                <span className="text-[9px] text-white/30 font-bold">CHANGE</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: priceColor }}>
                    {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(2)} ({diffPercent.toFixed(2)}%)
                </span>
            </div>

            {/* Indicators Section */}
            {indicators.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5 mt-0.5 max-h-[150px] overflow-hidden">
                    {indicators.map((ind) => (
                        <div key={ind.id} className="flex items-center justify-between px-0.5">
                            <span className="text-[9px] text-white/40 font-medium truncate pr-2 uppercase italic">
                                {ind.name}
                            </span>
                            {ind.values ? (
                                <div className="flex gap-2">
                                    {ind.values.map((v, i) => (
                                        <span key={i} className="text-[10px] font-mono font-bold" style={{ color: v.color }}>
                                            {v.value}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-[10px] font-mono font-bold" style={{ color: ind.color as string }}>
                                    {ind.value}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isLive && (
                <div className="absolute -top-1 -right-1 flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full backdrop-blur-md">
                    <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">Live</span>
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(34,197,94,1)]" />
                </div>
            )}
        </div>
    );
}
