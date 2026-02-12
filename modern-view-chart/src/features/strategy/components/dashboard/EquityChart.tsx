'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, AreaSeries, LineSeries } from 'lightweight-charts';

interface Props {
    data: { time: number; value: number }[];
}

export function EquityChart({ data }: Props) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#d1d4dc',
                fontFamily: "'JetBrains Mono', monospace",
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'rgba(197, 203, 206, 0.2)',
            },
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.2)',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
        });

        const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: '#2962FF',
            topColor: 'rgba(41, 98, 255, 0.2)',
            bottomColor: 'rgba(41, 98, 255, 0)',
            lineWidth: 2,
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        const baselineSeries = chart.addSeries(LineSeries, {
            color: 'rgba(255, 255, 255, 0.1)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // Ensure strictly ascending order (filter duplicates)
        const uniqueData: { time: number; value: number }[] = [];
        const seenTimes = new Set<number>();

        data.sort((a, b) => a.time - b.time).forEach(d => {
            if (!seenTimes.has(d.time)) {
                uniqueData.push(d);
                seenTimes.add(d.time);
            }
        });

        if (uniqueData.length > 0) {
            areaSeries.setData(uniqueData as any);

            // Add baseline (initial balance) - Only if we have a range
            const start = uniqueData[0];
            const end = uniqueData[uniqueData.length - 1];
            if (start.time < end.time) {
                const initialVal = start.value;
                baselineSeries.setData([
                    { time: start.time as any, value: initialVal },
                    { time: end.time as any, value: initialVal }
                ] as any);
            }
        }

        chart.timeScale().fitContent();
        chartRef.current = chart;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    return (
        <div className="bg-[#1e222d] rounded-xl border border-[#363a45] p-4 shadow-2xl">
            <div className="flex items-baseline gap-2 mb-4 px-2">
                <span className="text-[10px] font-black text-[#787b86] uppercase tracking-widest">Equity Curve</span>
                <span className="text-[8px] font-bold text-blue-500/50 uppercase">Virtual Growth</span>
            </div>
            <div ref={chartContainerRef} className="w-full" />
        </div>
    );
}
