'use client';

import React, { useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
// Using relative path to match the file structure
import { useCursorTooltipDOMUpdater } from '../hooks/use-cursor-tooltip-dom-updater';
import { isSmartAnalysis } from '../indicators/registry/indicator-categories';

interface CursorTooltipProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

export function CursorTooltip({ chartId, symbol, interval, source, candles }: CursorTooltipProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || []).filter((i: any) =>
            i.visible &&
            i.pane !== 'subchart' &&
            !isSmartAnalysis(i.type)
        )
    ));

    useCursorTooltipDOMUpdater(containerRef, { chartId, symbol, interval, source, candles });

    const isDataMissing = !symbol || !interval || !source || !candles.length;
    if (isDataMissing) return null;

    return (
        <div
            ref={containerRef}
            className="fixed z-[100] pointer-events-none select-none opacity-0 transition-opacity duration-150"
            style={{ left: 0, top: 0 }}
        >
            <div
                className="flex flex-col gap-0.5 p-1 rounded-md border border-primary/10 bg-background/[0.03] backdrop-blur-[1px] shadow-none subpixel-antialiased"
                data-tooltip-container
            >
                {/* OHLC Values - Ultra Compact Grid */}
                <div className="grid grid-cols-2 gap-x-1.5 gap-y-0 border-b border-border/5 pb-0.5">
                    <div className="flex items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground/60 font-bold">O</span>
                        <span data-ohlc="open" className="text-[10px] font-black text-foreground tabular-nums">---</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground/60 font-bold">H</span>
                        <span data-ohlc="high" className="text-[10px] font-black text-foreground tabular-nums">---</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground/60 font-bold">L</span>
                        <span data-ohlc="low" className="text-[10px] font-black text-foreground tabular-nums">---</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground/60 font-bold">C</span>
                        <span data-ohlc="close" className="text-[10px] font-black text-foreground tabular-nums">---</span>
                    </div>
                </div>

                {/* Change Info */}
                <div className="flex items-center justify-between px-0.5 leading-none">
                    <span data-ohlc="change" className="text-[9px] font-bold tabular-nums">---</span>
                    <span data-ohlc="change-percent" className="text-[9px] font-black tabular-nums">---</span>
                </div>

                {/* Indicators - Micro List */}
                {indicators.length > 0 && (
                    <div data-indicators className="flex flex-col gap-0 mt-0 border-t border-border/5 pt-0.5">
                        {indicators.map((ind: any) => (
                            <div key={ind.id} data-indicator-id={ind.id} className="flex items-center justify-between gap-1.5">
                                <span className="text-[8px] font-bold text-muted-foreground/50 uppercase truncate max-w-[40px]">
                                    {ind.type}
                                </span>
                                <div data-indicator-value className="text-[9px] font-black tabular-nums flex gap-0.5">
                                    {ind.type === 'MACD' ? (
                                        <>
                                            <span style={{ color: ind.color }}>-</span>
                                            <span style={{ color: '#FF6D00' }}>-</span>
                                            <span style={{ color: '#787b86' }}>-</span>
                                        </>
                                    ) : (
                                        <span style={{ color: ind.color }}>-</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Subtle Pointer */}
            <div className="absolute -left-0.5 -top-0.5 w-1 h-1 border border-primary/30 rounded-full bg-primary/20" />
        </div>
    );
}
