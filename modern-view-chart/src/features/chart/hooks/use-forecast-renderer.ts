'use client';

import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineSeries, AreaSeries, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { parseIntervalSeconds } from './use-chart-history.helpers';
import { safeRemoveSeries } from '@/features/chart/indicators/utils/safe-remove-series';

/**
 * Hook to render AI Price Forecast on a Lightweight Chart instance.
 * It overlays a dashed prediction line and a shaded confidence band.
 */
export function useForecastRenderer(
    priceChart: IChartApi | null,
    chartId: string,
    isReady: boolean
) {
    const forecastLineRef = useRef<ISeriesApi<'Line'> | null>(null);
    const upperBandRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lowerBandRef = useRef<ISeriesApi<'Line'> | null>(null);
    const areaBandRef = useRef<ISeriesApi<'Area'> | null>(null);

    // Select forecast data for this chart
    const forecast = useMarketStore((state) => {
        const tab = state.tabs[state.activeTabId];
        return tab?.charts[chartId]?.forecast;
    });

    const interval = useMarketStore((state) => {
        const tab = state.tabs[state.activeTabId];
        return tab?.charts[chartId]?.interval;
    });

    const symbol = useMarketStore((state) => {
        const tab = state.tabs[state.activeTabId];
        return tab?.charts[chartId]?.symbol;
    });

    // Clean up series when symbol or interval changes
    useEffect(() => {
        if (!priceChart) return;

        const cleanup = () => {
            safeRemoveSeries(priceChart, forecastLineRef.current, 'ForecastRenderer');
            safeRemoveSeries(priceChart, upperBandRef.current, 'ForecastRenderer');
            safeRemoveSeries(priceChart, lowerBandRef.current, 'ForecastRenderer');
            safeRemoveSeries(priceChart, areaBandRef.current, 'ForecastRenderer');
            forecastLineRef.current = null;
            upperBandRef.current = null;
            lowerBandRef.current = null;
            areaBandRef.current = null;
        };

        cleanup();
    }, [priceChart, symbol, interval]);

    useEffect(() => {
        if (!isReady || !priceChart || !forecast || !interval) return;

        // Ensure series exist
        if (!forecastLineRef.current) {
            forecastLineRef.current = priceChart.addSeries(LineSeries, {
                color: '#3b82f6', // blue-500
                lineWidth: 2,
                lineStyle: 2, // Dashed
                title: 'AI Forecast',
                lastValueVisible: true,
                priceLineVisible: false,
            });
        }

        if (!areaBandRef.current) {
            areaBandRef.current = priceChart.addSeries(AreaSeries, {
                topColor: 'rgba(59, 130, 246, 0.2)',
                bottomColor: 'rgba(59, 130, 246, 0.05)',
                lineColor: 'rgba(59, 130, 246, 0.3)',
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });
        }

        // Calculate timestamps for the forecast points
        const intervalSec = parseIntervalSeconds(interval);
        const lastTs = forecast.timestamp / 1000; // Store uses ms, chart uses seconds

        const lineData = forecast.points.map((p, i) => ({
            time: (lastTs + (i + 1) * intervalSec) as Time,
            value: p,
        }));

        // Reverting to two LineSeries for the band boundaries as it's more reliable for variable bands,
        // but keeping the forecast line dashed and blue.
        if (!upperBandRef.current) {
            upperBandRef.current = priceChart.addSeries(LineSeries, {
                color: 'rgba(59, 130, 246, 0.3)',
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });
        }

        if (!lowerBandRef.current) {
            lowerBandRef.current = priceChart.addSeries(LineSeries, {
                color: 'rgba(59, 130, 246, 0.3)',
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });
        }

        const upperData = forecast.upper_band.map((p, i) => ({
            time: (lastTs + (i + 1) * intervalSec) as Time,
            value: p,
        }));

        const lowerData = forecast.lower_band.map((p, i) => ({
            time: (lastTs + (i + 1) * intervalSec) as Time,
            value: p,
        }));

        forecastLineRef.current.setData(lineData);
        upperBandRef.current.setData(upperData);
        lowerBandRef.current.setData(lowerData);

        // Auto-fit the forecast into view if it's far out
        if (lineData.length > 0) {
            // priceChart.timeScale().scrollToPosition(1, true);
        }

    }, [isReady, priceChart, forecast, interval]);

    return null;
}
