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
    const [countdown, setCountdown] = useState<string>('');
    const [top, setTop] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Get current price and candles from store for the active symbol
    const activeChartId = useMarketStore(state => state.tabs[state.activeTabId]?.activeChartId);
    const chartInstance = useMarketStore(state => {
        if (!activeChartId) return null;
        return state.tabs[state.activeTabId]?.charts[activeChartId];
    });

    const symbol = chartInstance?.symbol;
    const source = chartInstance?.source;
    const normSymbol = symbol ? (symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol) : '';
    const currentPrice = useMarketStore(state => normSymbol ? state.tickers[normSymbol]?.price : null);

    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const lastCandle = useMarketStore(state => key ? state.candleData[key]?.[state.candleData[key].length - 1] : null);

    useEffect(() => {
        if (!chart || !series || !lastCandle || currentPrice === null) {
            setIsVisible(false);
            return;
        }

        const updatePosition = () => {
            const coordinate = series.priceToCoordinate(currentPrice);
            if (coordinate !== null) {
                setTop(coordinate);
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        const updateTime = () => {
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

                if (hours > 0) {
                    setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                } else {
                    setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                }
            } else {
                setCountdown('00:00');
            }
        };

        const intervalId = setInterval(() => {
            updateTime();
            updatePosition();
        }, 1000);

        updateTime();
        updatePosition();

        // Also update position on chart change/scroll
        chart.timeScale().subscribeVisibleLogicalRangeChange(updatePosition);

        return () => {
            clearInterval(intervalId);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(updatePosition);
        };
    }, [chart, series, lastCandle, currentPrice, interval]);

    if (!isVisible || top === null) return null;

    return (
        <div
            className="absolute right-[80px] z-[100] pointer-events-none select-none flex items-center"
            style={{
                top: `${top}px`,
                transform: 'translateY(-50%)',
                height: '22px',
            }}
        >
            <div className="bg-[#1e222d]/90 backdrop-blur-sm text-[#787b86] text-[10px] font-bold px-1.5 py-0.5 rounded-l-md border border-[#2a2e39] border-r-0 shadow-lg">
                {countdown}
            </div>
        </div>
    );
}
