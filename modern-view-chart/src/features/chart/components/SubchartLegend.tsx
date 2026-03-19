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

const getSeriesLabel = (seriesName: string): string => {
    const key = seriesName.toLowerCase();
    if (key === 'k') return '%K';
    if (key === 'd') return '%D';
    if (key === 'macd') return 'M';
    if (key === 'signal') return 'S';
    if (key === 'histogram') return 'H';
    if (key === 'plusdi') return '+DI';
    if (key === 'minusdi') return '-DI';
    if (key === 'adx') return 'ADX';
    return seriesName.toUpperCase();
};

const getSeriesColor = (seriesName: string, fallback: string): string => {
    const key = seriesName.toLowerCase();
    if (key === 'signal' || key === 'd') return '#FF6D00';
    if (key === 'plusdi' || key === 'k') return '#2196F3';
    if (key === 'minusdi') return '#ef5350';
    if (key === 'adx') return '#FFB74D';
    if (key === 'histogram') return '#26a69a';
    return fallback;
};

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
    const runtimeById = useMarketStore(useShallow(state =>
        Object.fromEntries((state.chartIndicatorRuntime[chartId] || []).map((item: any) => [item.id, item]))
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
                className="flex flex-col gap-0.5 p-1 backdrop-blur-[1.5px] border rounded-lg bg-background/5 border-border/10 w-fit"
            >
                {indicators.map((ind: any) => (
                    <div
                        key={ind.id}
                        data-indicator-id={ind.id}
                        className="flex flex-col px-1"
                    >
                        {(() => {
                            const runtime = runtimeById[ind.id];
                            const runtimeResults = runtime?.results;
                            const seriesKeys = runtimeResults && typeof runtimeResults === 'object' && !Array.isArray(runtimeResults)
                                ? Object.keys(runtimeResults).filter((keyName) => Array.isArray(runtimeResults[keyName]))
                                : [];
                            const isMultiSeries = seriesKeys.length > 0;
                            const label = ind.type === 'MACD'
                                ? 'MACD'
                                : (ind.type === 'Stochastic' || ind.type === 'STOCHASTIC')
                                    ? `STOCHASTIC ${ind.params?.periodK || 14}`
                                    : `${ind.type} ${ind.params?.period || 14}`;

                            return (
                                <>
                        <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-tighter leading-none mb-0.5">
                                        {label}
                        </span>

                        <div data-indicator-value className="flex gap-1.5 font-mono text-[11px] font-bold leading-none text-foreground">
                                        {isMultiSeries ? (
                                            seriesKeys.map((keyName: string, idx: number) => {
                                                const color = getSeriesColor(keyName, ind.color);
                                                const label = getSeriesLabel(keyName);
                                                return <span key={`${ind.id}-${keyName}-${idx}`} style={{ color }}>{label} ...</span>;
                                            })
                                        ) : (
                                <span style={{ color: ind.color }}>...</span>
                                        )}
                        </div>
                                </>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    );
}
