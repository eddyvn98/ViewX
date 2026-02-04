import { useRef, useEffect } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';

export function useChartInit(containerRef: React.RefObject<HTMLDivElement | null>) {
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { color: '#131722' },
                textColor: '#d4d4d8',
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 10,
                barSpacing: 6,
                rightBarStaysOnScroll: true,
            },
        });

        chartRef.current = chart;
        seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0] && chartRef.current) {
                const { width, height } = entries[0].contentRect;
                chartRef.current.applyOptions({ width, height });
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
            }
        };
    }, []);

    return { chartRef, seriesRef };
}
