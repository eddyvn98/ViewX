import { useRef } from 'react';
import { useSubchartLegendDOMUpdater } from '../hooks/use-subchart-legend-dom-updater';
import { Candle, useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';

interface SubchartLegendProps {
    chartId: string;
    symbol?: string;
    interval?: string;
    source?: string;
    candles?: Candle[]; // Optional, will fetch if not provided
}

const EMPTY_ARRAY: Candle[] = [];
const EMPTY_INDICATORS: any[] = [];

export function SubchartLegend({ chartId, symbol, interval, source, candles: propCandles }: SubchartLegendProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // 1. Get Candles (Prop or Store)
    const normSymbol = symbol?.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol;
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const storeCandles = useMarketStore(state => key ? (state.candleData[key] || EMPTY_ARRAY) : EMPTY_ARRAY);
    const candles = propCandles || storeCandles;

    // 2. Get Indicators Config (Stable)
    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || EMPTY_INDICATORS).filter((i: any) => i.visible && i.pane === 'subchart')
    ));

    // 3. ZERO-RENDER UPDATE HOOK
    useSubchartLegendDOMUpdater(containerRef, { chartId, symbol, interval, source, candles });

    if (!symbol || !interval || !source || !indicators.length) return null;

    return (
        <div
            ref={containerRef}
            className="absolute top-1 left-2 z-10 flex flex-col gap-1 pointer-events-none select-none"
        >
            <div data-indicators className="flex flex-col gap-1">
                {indicators.map((ind: any) => (
                    <div
                        key={ind.id}
                        data-indicator-id={ind.id} // Hook targets this
                        className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold bg-[#131722]/60 px-1 rounded backdrop-blur-[2px]"
                    >
                        <span className="text-zinc-500 uppercase">
                            {ind.type === 'MACD' ? 'MACD' : `${ind.type} ${ind.params?.period || 14}`}
                        </span>

                        {/* Hook updates textContent inside here */}
                        <div data-indicator-value className="flex items-center gap-1">
                            {ind.type === 'MACD' ? (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        <span style={{ color: ind.color }}>···</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span style={{ color: '#FF6D00' }}>···</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span>···</span>
                                    </div>
                                </div>
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
