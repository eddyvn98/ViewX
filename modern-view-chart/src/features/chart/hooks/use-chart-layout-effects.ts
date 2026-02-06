import { useEffect } from 'react';
import { IChartApi } from 'lightweight-charts';

export function useChartLayoutEffects(
    priceChartRef: React.MutableRefObject<IChartApi | null>,
    subchartChartRef: React.MutableRefObject<IChartApi | null>,
    timescaleChartRef: React.MutableRefObject<IChartApi | null>,
    timezone: string,
    isSubchartVisible: boolean
) {
    // Dynamic margin adjustment to keep candles above the subchart overlay
    useEffect(() => {
        if (!priceChartRef.current) return;

        const bottomMargin = isSubchartVisible ? 0.32 : 0.08; // 32% if overlay (25%) is visible
        priceChartRef.current.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.08,
                bottom: bottomMargin
            }
        });
    }, [isSubchartVisible, priceChartRef]);

    // Apply Timezone to Chart Localization & Scale
    useEffect(() => {
        if (!priceChartRef.current || !timezone) return;

        const timeFormatter = (timestamp: number) => {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(timestamp * 1000).replace(',', '');
        };

        const tickMarkFormatter = (time: number) => {
            const date = new Date(time * 1000);
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(date);
        };

        const localizationOptions = {
            localization: {
                timeFormatter,
            },
        };

        const timeScaleOptions = {
            timeScale: {
                tickMarkFormatter,
            },
        };

        priceChartRef.current.applyOptions(localizationOptions);
        (priceChartRef.current.timeScale() as any).applyOptions(timeScaleOptions.timeScale);

        if (subchartChartRef.current) {
            subchartChartRef.current.applyOptions(localizationOptions);
            (subchartChartRef.current.timeScale() as any).applyOptions(timeScaleOptions.timeScale);
        }

        if (timescaleChartRef.current) {
            timescaleChartRef.current.applyOptions(localizationOptions);
            (timescaleChartRef.current.timeScale() as any).applyOptions(timeScaleOptions.timeScale);
        }
    }, [timezone, priceChartRef, subchartChartRef, timescaleChartRef]);
}
