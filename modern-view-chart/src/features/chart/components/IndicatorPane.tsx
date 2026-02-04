'use client';

import React, { useEffect, useRef, memo, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, LineSeries, CandlestickSeries } from 'lightweight-charts';
import { Candle, IndicatorConfig, useMarketStore } from '@/lib/store';
import { EMAIndicator } from '../indicators/EMAIndicator';
import { HMAIndicator } from '../indicators/HMAIndicator';
import { RSIIndicator } from '../indicators/RSIIndicator';
import { calculateRSI } from '../utils/indicator-math';
import { getChartTimezoneOffset } from '../utils/time-utils';

interface IndicatorPaneProps {
    chartId: string;
    indicator: IndicatorConfig;
    candles: Candle[];
    onChartCreated: (id: string, chart: IChartApi) => void;
    onChartDestroyed: (id: string) => void;
}

export const IndicatorPane = memo(function IndicatorPane({
    chartId,
    indicator,
    candles,
    onChartCreated,
    onChartDestroyed
}: IndicatorPaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const instanceRef = useRef<any>(null);
    const mainSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { color: 'transparent' }, // OVERLAY: Transparent BG
                textColor: '#71717a',
            },
            grid: {
                vertLines: { visible: false }, // Hide Grid for Overlay feel
                horzLines: { visible: false },
            },
            width: containerRef.current.clientWidth || 800,
            height: 160,
            timeScale: {
                visible: true, // Keep visible for internal logic, hide elements
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'transparent',
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false, // Cleaner overlay
            },
            crosshair: {
                vertLine: { labelVisible: false },
                horzLine: { labelVisible: true, labelBackgroundColor: '#18181b' },
            },
            handleScale: false,
            handleScroll: false,
        });

        chartRef.current = chart;

        // Monitor this change: Transparent series to ensure TimeScale works
        mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: '#00000000',
            downColor: '#00000000',
            borderVisible: false,
            wickUpColor: '#00000000',
            wickDownColor: '#00000000',
            priceScaleId: '',
            visible: true
        });


        console.log('[INDICATOR PANE] Chart created for', indicator.type, {
            chartId: indicator.id,
            width: containerRef.current.clientWidth,
            height: 160
        });

        onChartCreated(indicator.id, chart);

        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0] && chartRef.current) {
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0) {
                    chartRef.current.applyOptions({ width, height });
                    if (height === 0) console.error('[RSI] Zero Height Detected!');
                }
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (chartRef.current) {
                chart.remove();
                chartRef.current = null;
                mainSeriesRef.current = null;
                onChartDestroyed(indicator.id);
            }
        };
    }, []);

    const timezone = useMarketStore(state => {
        const activeTabId = state.activeTabId;
        const tab = state.tabs[activeTabId || ''];
        return tab?.charts[chartId]?.timezone || 'Etc/UTC';
    });

    const offset = useMemo(() => getChartTimezoneOffset(timezone), [timezone]);

    const formattedCandles = useMemo(() => {
        return candles.map(c => ({
            ...c,
            time: (c.time as number) + offset
        }));
    }, [candles, offset]);

    // Technical indicator logic
    useEffect(() => {
        if (!chartRef.current) return;

        // Update invisible base series
        if (mainSeriesRef.current && formattedCandles.length > 0) {
            mainSeriesRef.current.setData(formattedCandles as any);
        }

        if (!instanceRef.current) {
            switch (indicator.type) {
                case 'RSI':
                    instanceRef.current = new RSIIndicator(chartRef.current, indicator);
                    break;
                case 'EMA':
                    instanceRef.current = new EMAIndicator(chartRef.current, indicator);
                    break;
                case 'HMA':
                    instanceRef.current = new HMAIndicator(chartRef.current, indicator);
                    break;
            }
        }

        if (instanceRef.current) {
            instanceRef.current.update(formattedCandles, indicator);
        }

    }, [indicator, formattedCandles]);

    const lastValue = useMemo(() => {
        if (indicator.type === 'RSI' && candles.length > 20) {
            const rsi = calculateRSI(candles.map(c => c.close), indicator.params.period || 14);
            return rsi[rsi.length - 1];
        }
        return null;
    }, [candles, indicator]);

    return (
        <div className="relative w-full bg-zinc-900/40 backdrop-blur-sm group/pane border-b border-zinc-800/50">
            <div ref={containerRef} className="w-full h-[160px]" />
            {/* Header Overlay for Pane */}
            <div className="absolute top-1 left-3 z-[60] flex items-center gap-2 pointer-events-none bg-zinc-950/60 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/5 shadow-lg">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    {indicator.type} {indicator.params.period}
                </span>
                <span className="text-[11px] font-bold text-green-400 font-mono">
                    {typeof lastValue === 'number' && !isNaN(lastValue) ? lastValue.toFixed(2) : '···'}
                </span>
            </div>
        </div>
    );
});
