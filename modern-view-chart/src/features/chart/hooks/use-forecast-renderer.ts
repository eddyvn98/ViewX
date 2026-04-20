'use client';

import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineSeries, AreaSeries } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { ForecastData } from '@/lib/store/types';

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

    // Helper to get interval in seconds
    const getIntervalSeconds = (tf: string): number => {
        const unit = tf.slice(-1).toLowerCase();
        const value = parseInt(tf);
        if (isNaN(value)) return 15 * 60; // Default 15m

        if (unit === 'm') return value * 60;
        if (unit === 'h') return value * 3600;
        if (unit === 'd') return value * 86400;
        if (unit === 'w') return value * 604800;
        
        // Handle numeric-only (default to minutes)
        if (/^\d+$/.test(tf)) return value * 60;
        
        return value * 60;
    };

    // Clean up series when symbol or interval changes
    useEffect(() => {
        if (!priceChart) return;
        
        const cleanup = () => {
            if (forecastLineRef.current) {
                priceChart.removeSeries(forecastLineRef.current);
                forecastLineRef.current = null;
            }
            if (upperBandRef.current) {
                priceChart.removeSeries(upperBandRef.current);
                upperBandRef.current = null;
            }
            if (lowerBandRef.current) {
                priceChart.removeSeries(lowerBandRef.current);
                lowerBandRef.current = null;
            }
            if (areaBandRef.current) {
                priceChart.removeSeries(areaBandRef.current);
                areaBandRef.current = null;
            }
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
        const intervalSec = getIntervalSeconds(interval);
        const lastTs = forecast.timestamp / 1000; // Store uses ms, chart uses seconds
        
        const lineData = forecast.points.map((p, i) => ({
            time: (lastTs + (i + 1) * intervalSec) as any,
            value: p,
        }));

        const areaData = forecast.lower_band.map((p, i) => ({
            time: (lastTs + (i + 1) * intervalSec) as any,
            value: forecast.upper_band[i], // For AreaSeries, value is the "top" if we don't have baseValue?
            // Wait, AreaSeries in Lightweight Charts has a single value. 
            // To show a band, we usually use two LineSeries with an autoscale or a custom plugin.
            // But we can use one AreaSeries and set baseValue if it's constant.
            // Actually, for a variable band, the best way is indeed two LineSeries or a custom series.
            // However, we can use a clever trick with AreaSeries if we want shading.
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
            time: (lastTs + (i + 1) * intervalSec) as any,
            value: p,
        }));

        const lowerData = forecast.lower_band.map((p, i) => ({
            time: (lastTs + (i + 1) * intervalSec) as any,
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
