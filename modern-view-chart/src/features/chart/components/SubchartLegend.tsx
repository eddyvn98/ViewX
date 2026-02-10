import { useMemo } from 'react';
import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useChartIndicatorValues, IndicatorValueItem } from '../hooks/use-chart-indicator-values';
import { Candle, useMarketStore } from '@/lib/store';

interface SubchartLegendProps {
    chartId: string;
    symbol?: string;
    interval?: string;
    source?: string;
    candles: Candle[];
}

const EMPTY_ARRAY: Candle[] = [];

export function SubchartLegend({ chartId, symbol, interval, source }: Omit<SubchartLegendProps, 'candles'>) {
    const normSymbol = symbol?.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol;
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const candles = useMarketStore(state => key ? (state.candleData[key] || EMPTY_ARRAY) : EMPTY_ARRAY);

    const data = useChartOHLC(symbol, interval, source);
    const activeIndex = data?.activeIndex ?? -1;

    // Get all indicators with real-time price from data.close
    const allIndicators = useChartIndicatorValues(chartId, candles, activeIndex, data?.close);

    const subchartIndicators = useMemo(() => {
        return allIndicators.filter(i => i.pane === 'subchart');
    }, [allIndicators]);

    if (!subchartIndicators.length) return null;

    return (
        <div className="absolute top-1 left-2 z-10 flex flex-col gap-1 pointer-events-none select-none">
            {subchartIndicators.map((item: IndicatorValueItem) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold bg-[#131722]/60 px-1 rounded backdrop-blur-[2px]">
                    <span className="text-zinc-500 uppercase">{item.name}</span>

                    {/* Render Multi-values (MACD) */}
                    {item.values ? (
                        <div className="flex items-center gap-3">
                            {item.values.map((v, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <span style={{ color: v.color }}>{v.value}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Render Single Value (RSI)
                        <span style={{ color: item.color }}>{item.value}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
