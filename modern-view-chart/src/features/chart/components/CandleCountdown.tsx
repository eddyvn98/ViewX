'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ISeriesApi, IChartApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';

interface CandleCountdownProps {
    chart: IChartApi | null;
    series: ISeriesApi<'Candlestick'> | null;
    interval: string | undefined;
}

export function CandleCountdown({ chart, series, interval }: CandleCountdownProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const countdownRef = useRef<HTMLDivElement>(null);

    // Use smaller selectors for static config
    const activeChartId = useMarketStore(state => state.tabs[state.activeTabId]?.activeChartId);

    useEffect(() => {
        if (!chart || !series || !activeChartId) return;

        const chartInstance = useMarketStore.getState().tabs[useMarketStore.getState().activeTabId]?.charts[activeChartId];
        if (!chartInstance) return;

        const symbol = chartInstance.symbol;
        const source = chartInstance.source;
        const normSymbol = symbol ? (symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol) : '';
        const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';

        const updateDOM = () => {
            const state = useMarketStore.getState();
            const currentPrice = state.tickers[normSymbol]?.price;
            const candles = state.candleData[key] || [];
            const lastCandle = candles[candles.length - 1];

            if (!containerRef.current || !countdownRef.current || !lastCandle || currentPrice === null || currentPrice === undefined) {
                if (containerRef.current) containerRef.current.style.display = 'none';
                return;
            }

            // 1. Update Position
            const coordinate = series.priceToCoordinate(currentPrice);
            if (coordinate !== null) {
                containerRef.current.style.display = 'flex';
                containerRef.current.style.top = `${coordinate}px`;
            } else {
                containerRef.current.style.display = 'none';
            }

            // 2. Update Countdown Text
            const now = Math.floor(Date.now() / 1000);
            let timeframeSeconds = 60;
            if (interval) {
                if (interval === 'D') timeframeSeconds = 86400;
                else if (interval === 'W') timeframeSeconds = 604800;
                else if (interval === 'M') timeframeSeconds = 2592000;
                else {
                    const parsed = parseInt(interval);
                    if (!isNaN(parsed)) timeframeSeconds = parsed * 60;
                }
            }

            const lastCandleTime = typeof lastCandle.time === 'object'
                ? (lastCandle.time as any).timestamp
                : Number(lastCandle.time);

            const nextCandleTime = lastCandleTime + timeframeSeconds;
            const secondsLeft = nextCandleTime - now;

            if (secondsLeft > 0) {
                const hours = Math.floor(secondsLeft / 3600);
                const minutes = Math.floor((secondsLeft % 3600) / 60);
                const seconds = secondsLeft % 60;

                const text = hours > 0
                    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                countdownRef.current.textContent = text;
            } else {
                countdownRef.current.textContent = '00:00';
            }
        };

        const intervalId = setInterval(() => {
            requestAnimationFrame(updateDOM);
        }, 1000);

        updateDOM();

        // Also update position on chart change/scroll
        chart.timeScale().subscribeVisibleLogicalRangeChange(updateDOM);

        return () => {
            clearInterval(intervalId);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateDOM);
        };
    }, [chart, series, activeChartId, interval]);

    return (
        <div
            ref={containerRef}
            className="absolute right-[80px] z-[100] pointer-events-none select-none items-center hidden"
            style={{
                transform: 'translateY(-50%)',
                height: '22px',
            }}
        >
            <div
                ref={countdownRef}
                className="bg-[#1e222d]/90 backdrop-blur-sm text-[#787b86] text-[10px] font-bold px-1.5 py-0.5 rounded-l-md border border-[#2a2e39] border-r-0 shadow-lg"
            >
                --:--
            </div>
        </div>
    );
}
