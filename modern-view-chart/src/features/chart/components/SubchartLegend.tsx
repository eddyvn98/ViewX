import { useRef } from 'react';
import { useSubchartLegendDOMUpdater } from '../hooks/use-subchart-legend-dom-updater';
import { Candle, useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { normalizeSymbol } from '@/lib/utils/symbol';

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
    const normSymbol = normalizeSymbol(symbol);
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const storeCandles = useMarketStore(state => key ? (state.candleData[key] || EMPTY_ARRAY) : EMPTY_ARRAY);
    const candles = propCandles || storeCandles;

    // 2. Get Indicators Config (Stable)
    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || EMPTY_INDICATORS).filter((i: any) => i.visible && i.pane === 'subchart')
    ));

    // 3. ZERO-RENDER UPDATE HOOK
    useSubchartLegendDOMUpdater(containerRef, { chartId, symbol, interval, source, candles });

    const isDataMissing = !symbol || !interval || !source || !indicators.length;

    return (
        <div
            ref={containerRef}
            className={`absolute top-1 left-2 z-10 flex flex-col gap-1 pointer-events-none select-none transition-opacity duration-300 ${isDataMissing ? 'opacity-0' : 'opacity-100'}`}
        >
            <div
                data-indicators
                className="flex flex-col gap-0.5 p-1 backdrop-blur-lg border rounded-lg bg-background/50 border-border/10 w-fit"
            >
                {indicators.map((ind: any) => (
                    <div
                        key={ind.id}
                        data-indicator-id={ind.id}
                        className="flex flex-col px-1"
                    >
                        <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-tighter leading-none mb-0.5">
                            {ind.type === 'MACD' ? 'MACD' : `${ind.type} ${ind.params?.period || 14}`}
                        </span>

                        <div data-indicator-value className="flex gap-1.5 font-mono text-[11px] font-bold leading-none text-foreground">
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
