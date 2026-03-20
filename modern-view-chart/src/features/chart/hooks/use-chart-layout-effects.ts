import { useEffect } from 'react';
import { IChartApi, Time } from 'lightweight-charts';
import { normalizeCrosshairTime } from './init/normalize-crosshair-time';

export function useChartLayoutEffects(
    priceChartRef: React.MutableRefObject<IChartApi | null>,
    subchartChartRef: React.MutableRefObject<IChartApi | null>,
    timescaleChartRef: React.MutableRefObject<IChartApi | null>,
    timezone: string,
    isSubchartVisible: boolean
) {
    // Dynamic margin adjustment to keep candles above the subchart overlay
    useEffect(() => {
        const chart = priceChartRef.current;
        if (!chart) return;

        const bottomMargin = isSubchartVisible ? 0.32 : 0.08; // 32% if overlay (25%) is visible
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
    }, [isSubchartVisible, priceChartRef]);

    // Apply Timezone to Chart Localization & Scale
    useEffect(() => {
        if (!priceChartRef.current || !timezone) return;

        const tickLabelFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const timeLabelFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });

        const timeFormatter = (timestamp: number) => {
            return timeLabelFormatter.format(timestamp * 1000).replace(',', '');
        };

        const tickMarkFormatter = (time: Time) => {
            const sec = normalizeCrosshairTime(time);
            if (sec == null) return '';
            return tickLabelFormatter.format(sec * 1000);
        };

        const localizationOptions = {
            localization: {
                timeFormatter,
                tickMarkFormatter,
            },
        };

        try {
            priceChartRef.current.applyOptions({
                ...localizationOptions,
                timeScale: {
                    tickMarkFormatter,
                },
            });
        } catch {
            // Ignore transient layout errors while chart instances are being recreated.
        }

        if (subchartChartRef.current) {
            try {
                subchartChartRef.current.applyOptions({
                    ...localizationOptions,
                    timeScale: {
                        tickMarkFormatter,
                    },
                });
            } catch {
                // Ignore transient layout errors while chart instances are being recreated.
            }
        }

        if (timescaleChartRef.current) {
            try {
                timescaleChartRef.current.applyOptions({
                    ...localizationOptions,
                    timeScale: {
                        tickMarkFormatter,
                    },
                });
            } catch {
                // Ignore transient layout errors while chart instances are being recreated.
            }
        }
    }, [timezone, priceChartRef, subchartChartRef, timescaleChartRef]);
}
