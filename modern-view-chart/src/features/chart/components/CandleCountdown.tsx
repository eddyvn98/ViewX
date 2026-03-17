'use client';

import React, { useEffect, useRef } from 'react';
import { ISeriesApi, IChartApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { normalizeSymbol } from '@/lib/utils/symbol';

type RealtimeCandleLike = {
    open?: number;
    close?: number;
    time?: number | { timestamp?: number };
};

interface CandleCountdownProps {
    chart: IChartApi | null;
    series: ISeriesApi<'Candlestick'> | null;
    interval: string | undefined;
    realTimeRef: React.MutableRefObject<RealtimeCandleLike | null> | undefined;
}

export function CandleCountdown({ chart, series, interval, realTimeRef }: CandleCountdownProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const countdownRef = useRef<HTMLDivElement>(null);
    const priceRef = useRef<HTMLDivElement>(null);
    const isTimescaleInteractingRef = useRef(false);

    // Use smaller selectors for static config
    const activeChartId = useMarketStore(state => state.tabs[state.activeTabId]?.activeChartId);

    useEffect(() => {
        if (!chart || !series || !activeChartId) return;

        const stateSnapshot = useMarketStore.getState();
        const activeTab = stateSnapshot.tabs[stateSnapshot.activeTabId];
        const chartInstance = activeTab?.charts[activeChartId];
        if (!chartInstance) return;

        const symbol = chartInstance.symbol;
        const source = chartInstance.source;
        const normSymbol = normalizeSymbol(symbol);
        const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';

        // Disable native last value label to avoid overlap
        series.applyOptions({ lastValueVisible: false });

        const updateDOM = () => {
            if (!containerRef.current) return;
            if (isTimescaleInteractingRef.current) {
                containerRef.current.style.display = 'none';
                return;
            }
            const state = useMarketStore.getState();
            const symbolInfo = state.symbolInfo[normSymbol];
            const currentPrice = realTimeRef?.current?.close ?? state.tickers[normSymbol]?.price;
            const candles = state.candleData[key] || [];
            const lastCandle = realTimeRef?.current || candles[candles.length - 1];

            if (!lastCandle || currentPrice === null || currentPrice === undefined) {
                containerRef.current.style.display = 'none';
                return;
            }

            // 1. Update Position & Color
            const coordinate = series.priceToCoordinate(currentPrice);
            if (coordinate !== null) {
                containerRef.current.style.display = 'flex';
                containerRef.current.style.top = `${coordinate}px`;

                // Color based on trend
                const isUp = currentPrice >= (lastCandle.open || currentPrice);
                containerRef.current.className = `absolute right-0 z-50 flex flex-col items-start pl-2 justify-center pointer-events-none select-none transition-colors duration-200 ${isUp ? 'bg-emerald-600' : 'bg-rose-600'} rounded-l-md shadow-sm border-y border-l border-white/20 w-[62px] h-[36px]`;
            } else {
                containerRef.current.style.display = 'none';
            }

            // 2. Update Price Text
            if (priceRef.current) {
                priceRef.current.textContent = currentPrice.toFixed(symbolInfo?.digits || 2);
            }

            // 3. Update Countdown Text
            const now = Math.floor(Date.now() / 1000);
            let timeframeSeconds = 60;
            if (interval) {
                if (interval === '1D' || interval === 'D') timeframeSeconds = 86400;
                else if (interval === '1W' || interval === 'W') timeframeSeconds = 604800;
                else if (interval === '1M' || interval === 'M') timeframeSeconds = 2592000;
                else if (interval.endsWith('h') || interval.endsWith('H')) timeframeSeconds = parseInt(interval) * 3600;
                else if (interval.endsWith('d') || interval.endsWith('D')) timeframeSeconds = parseInt(interval) * 86400;
                else {
                    const parsed = parseInt(interval);
                    if (!isNaN(parsed)) timeframeSeconds = parsed * 60;
                }
            }

            const lastCandleTime = typeof lastCandle.time === 'object'
                ? Number((lastCandle.time as { timestamp?: number }).timestamp ?? 0)
                : Number(lastCandle.time);

            const nextCandleTime = lastCandleTime + timeframeSeconds;
            let secondsLeft = nextCandleTime - now;
            if (secondsLeft < 0) secondsLeft = 0;

            if (secondsLeft >= 0) {
                const hours = Math.floor(secondsLeft / 3600);
                const minutes = Math.floor((secondsLeft % 3600) / 60);
                const seconds = secondsLeft % 60;
                const text = hours > 0
                    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                if (countdownRef.current) {
                    countdownRef.current.textContent = text;
                }
            }
        };

        const intervalId = setInterval(() => requestAnimationFrame(updateDOM), 1000);
        updateDOM();
        chart.timeScale().subscribeVisibleLogicalRangeChange(updateDOM);

        const handleTimescaleInteraction = (event: Event) => {
            const detail = (event as CustomEvent<{ chartId?: string; active?: boolean }>).detail;
            if (detail?.chartId !== activeChartId) return;
            isTimescaleInteractingRef.current = Boolean(detail.active);
            if (!detail.active) {
                requestAnimationFrame(updateDOM);
            }
        };
        window.addEventListener('chart-timescale-interaction', handleTimescaleInteraction as EventListener);

        return () => {
            clearInterval(intervalId);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateDOM);
            window.removeEventListener('chart-timescale-interaction', handleTimescaleInteraction as EventListener);
            // Restore native label on unmount
            series.applyOptions({ lastValueVisible: true });
        };
    }, [chart, series, activeChartId, interval, realTimeRef]);

    return (
        <div
            ref={containerRef}
            className="absolute right-0 z-50 flex flex-col items-center pointer-events-none select-none hidden"
            style={{ transform: 'translateY(-50%)' }}
        >
            <div ref={priceRef} className="text-white text-[11px] font-bold leading-none">--</div>
            <div ref={countdownRef} className="text-white/90 text-[9px] font-medium leading-none mt-0.5">--:--</div>
        </div>
    );
}
