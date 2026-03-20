import { useEffect } from 'react';
import { IChartApi } from 'lightweight-charts';

type TimeScaleWithOptions = {
    applyOptions: (options: { tickMarkFormatter: (time: number) => string }) => void;
};

export function useChartLayoutEffects(
    priceChartRef: React.MutableRefObject<IChartApi | null>,
    subchartChartRef: React.MutableRefObject<IChartApi | null>,
    timescaleChartRef: React.MutableRefObject<IChartApi | null>,
    timezone: string,
    isSubchartVisible: boolean,
    subchartHeightPct: number
) {
    // Dynamic margin adjustment to keep candles above the subchart overlay
    useEffect(() => {
        const chart = priceChartRef.current;
        if (!chart) return;

        const normalizedSubchartPct = Math.max(3, Math.min(85, subchartHeightPct || 25));
        const bottomMargin = isSubchartVisible ? Math.min(0.9, normalizedSubchartPct / 100 + 0.05) : 0.08;
        try {
            chart.priceScale('right').applyOptions({
                scaleMargins: {
                    top: 0.08,
                    bottom: bottomMargin
                }
            });
        } catch {
            // Chart can be in transient dispose/recreate state during StrictMode + layout remount.
        }
    }, [isSubchartVisible, subchartHeightPct, priceChartRef]);

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

        try {
            priceChartRef.current.applyOptions(localizationOptions);
            (priceChartRef.current.timeScale() as unknown as TimeScaleWithOptions).applyOptions(timeScaleOptions.timeScale);
        } catch {
            // Ignore transient layout errors while chart instances are being recreated.
        }

        if (subchartChartRef.current) {
            try {
                subchartChartRef.current.applyOptions(localizationOptions);
                (subchartChartRef.current.timeScale() as unknown as TimeScaleWithOptions).applyOptions(timeScaleOptions.timeScale);
            } catch {
                // Ignore transient layout errors while chart instances are being recreated.
            }
        }

        if (timescaleChartRef.current) {
            try {
                timescaleChartRef.current.applyOptions(localizationOptions);
                (timescaleChartRef.current.timeScale() as unknown as TimeScaleWithOptions).applyOptions(timeScaleOptions.timeScale);
            } catch {
                // Ignore transient layout errors while chart instances are being recreated.
            }
        }
    }, [timezone, priceChartRef, subchartChartRef, timescaleChartRef]);
}
