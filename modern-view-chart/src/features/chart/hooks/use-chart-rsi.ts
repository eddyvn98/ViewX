import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import { Candle } from '@/lib/store';
import { calculateRSI } from '../utils/indicator-math';

export function useChartRSI(
    chartRef: React.RefObject<IChartApi | null>,
    candles: Candle[]
) {
    const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    useEffect(() => {
        if (!chartRef.current || candles.length < 15) return;
        const chart = chartRef.current;

        // 1. Calculate RSI
        const closePrices = candles.map(c => c.close);
        const rsiData = calculateRSI(closePrices, 14);

        // 2. Add RSI Series if not exists
        if (!rsiSeriesRef.current) {
            rsiSeriesRef.current = chart.addSeries(LineSeries, {
                color: '#7e57c2',
                lineWidth: 2,
                title: 'RSI 14',
                priceScaleId: 'rsi', // Separate scale
            });

            // Configure the RSI price scale
            chart.priceScale('rsi').applyOptions({
                autoScale: false,
                scaleMargins: {
                    top: 0.8, // Position at the bottom
                    bottom: 0.05,
                },
                borderVisible: true,
            });

            // Add Limit Lines (40 and 60)
            rsiSeriesRef.current.createPriceLine({
                price: 60,
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '60',
            });

            rsiSeriesRef.current.createPriceLine({
                price: 40,
                color: '#22c55e',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '40',
            });
        }

        // 3. Set Data
        const rsiChartData = candles.map((c, i) => ({
            time: c.time as any,
            value: rsiData[i]
        })).filter(d => !isNaN(d.value));

        rsiSeriesRef.current.setData(rsiChartData);

        return () => {
            if (rsiSeriesRef.current) {
                chart.removeSeries(rsiSeriesRef.current);
                rsiSeriesRef.current = null;
            }
        };
    }, [chartRef, candles]);
}
