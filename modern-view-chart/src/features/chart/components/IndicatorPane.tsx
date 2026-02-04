'use client';

import React, { useEffect, useRef, memo, useMemo } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickSeries
} from 'lightweight-charts';
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
    const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    // ===== CREATE CHART =====
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { color: 'transparent' },
                textColor: '#71717a',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            width: containerRef.current.clientWidth,
            height: 160,
            timeScale: {
                visible: true,
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'transparent',
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false,
            },
            leftPriceScale: {
                visible: false,
            },
            crosshair: {
                vertLine: { labelVisible: false },
                horzLine: { labelVisible: true },
            },
            handleScale: false,
            handleScroll: false,
        });

        chartRef.current = chart;

        // ⚠️ FIX CHÍ MẠNG: Đẩy lớp nến ẩn sang leftScale (đã ẩn) để không làm loạn scale của RSI
        mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: 'transparent',
            downColor: 'transparent',
            borderVisible: false,
            wickUpColor: 'transparent',
            wickDownColor: 'transparent',
            visible: true,
            priceScaleId: 'left',
        });

        onChartCreated(indicator.id, chart);

        const resizeObserver = new ResizeObserver(entries => {
            if (!chartRef.current) return;
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                chartRef.current.applyOptions({ width, height });
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            mainSeriesRef.current = null;
            onChartDestroyed(indicator.id);
        };
    }, []);

    // ===== TIMEZONE =====
    const timezone = useMarketStore(state => {
        const tab = state.tabs[state.activeTabId || ''];
        return tab?.charts[chartId]?.timezone || 'Etc/UTC';
    });

    const offset = useMemo(
        () => getChartTimezoneOffset(timezone),
        [timezone]
    );

    const formattedCandles = useMemo(() => {
        const seen = new Set<number>();
        const result: any[] = [];

        // Iterate backwards to keep the latest candle for each timestamp
        for (let i = candles.length - 1; i >= 0; i--) {
            const time = Math.floor(((candles[i].time as number) + offset) / 1000);
            if (!seen.has(time)) {
                seen.add(time);
                result.push({
                    ...candles[i],
                    time,
                });
            }
        }
        return result.sort((a, b) => (a.time as number) - (b.time as number));
    }, [candles, offset]);

    // ===== INDICATOR UPDATE =====
    useEffect(() => {
        if (!chartRef.current) return;

        if (mainSeriesRef.current && formattedCandles.length) {
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

        instanceRef.current?.update(formattedCandles, indicator);
    }, [formattedCandles, indicator]);

    // ===== HEADER VALUE =====
    const lastValue = useMemo(() => {
        if (indicator.type === 'RSI' && candles.length > 20) {
            const rsi = calculateRSI(
                candles.map(c => c.close),
                indicator.params.period || 14
            );
            return rsi[rsi.length - 1];
        }
        return null;
    }, [candles, indicator]);

    return (
        <div className="relative w-full bg-zinc-900/40 backdrop-blur-sm border-b border-zinc-800/50">
            <div ref={containerRef} className="w-full h-[160px]" />

            <div className="absolute top-1 left-3 z-50 flex gap-2 pointer-events-none bg-zinc-950/60 px-1.5 py-0.5 rounded">
                <span className="text-[10px] font-bold text-zinc-400">
                    {indicator.type} {indicator.params.period}
                </span>
                <span className="text-[11px] font-mono text-green-400">
                    {Number.isFinite(lastValue) ? lastValue?.toFixed(2) : '···'}
                </span>
            </div>
        </div>
    );
});
