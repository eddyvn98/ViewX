'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useChartIndicatorValues } from '../hooks/use-chart-indicator-values';

interface IndicatorsHeaderProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
}

export function IndicatorsHeader({ chartId, symbol, interval, source }: IndicatorsHeaderProps) {
    const ohlcData = useChartOHLC(symbol, interval, source);
    const candleData = useMarketStore(state => state.candleData);

    // Get candles from store
    const candles = React.useMemo(() => {
        if (!symbol || !interval || !source) return [];
        const normSymbol = symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol;
        const key = `${source}:${normSymbol}:${interval}`;
        return candleData[key] || [];
    }, [symbol, interval, source, candleData]);

    const activeIndex = ohlcData?.activeIndex ?? -1;
    const currentPrice = ohlcData?.isLive ? ohlcData.close : undefined;

    // Indicators only for main pane (filter out subchart indicators like RSI)
    const indicatorValues = useChartIndicatorValues(chartId, candles, activeIndex, currentPrice);
    const mainIndicators = indicatorValues.filter(v => v.pane !== 'subchart');

    if (mainIndicators.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {mainIndicators.map((val) => (
                <div key={val.id} className="flex items-center gap-1.5 opacity-90">
                    <span className="text-[9px] font-extrabold uppercase tracking-tight text-white/40 italic">
                        {val.name}
                    </span>
                    {val.values ? (
                        <div className="flex gap-1.5">
                            {val.values.map((v, i) => (
                                <span key={i} className="text-[10px] font-bold font-mono" style={{ color: v.color }}>
                                    {v.value}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span
                            className="text-[10px] font-bold font-mono"
                            style={{ color: val.color }}
                        >
                            {val.value}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
