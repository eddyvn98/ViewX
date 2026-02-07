'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateEMA, calculateRSI, calculateHullMA, calculateMACD } from '../utils/indicator-math';

interface LegendDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

interface IndicatorCache {
    type: string;
    id: string;
    period: number;
    color: string;
    pane: string;
    results: number[] | { macd: number[]; signal: number[]; histogram: number[] };
    params?: any;
}

/**
 * Hook that bypasses React for legend updates.
 * Uses direct DOM manipulation + requestAnimationFrame for 60fps performance.
 */
export function useLegendDOMUpdater(
    containerRef: React.RefObject<HTMLDivElement | null>,
    { chartId, symbol, interval, source, candles }: LegendDOMUpdaterProps
) {
    // Cache indicator calculations (only recalc when candles change)
    const indicatorCacheRef = useRef<IndicatorCache[]>([]);
    const lastCandleCountRef = useRef(0);
    const rafIdRef = useRef<number | null>(null);

    // DOM element refs
    const ohlcRefsRef = useRef<{
        open: HTMLElement | null;
        high: HTMLElement | null;
        low: HTMLElement | null;
        close: HTMLElement | null;
        change: HTMLElement | null;
        changePercent: HTMLElement | null;
        statusDot: HTMLElement | null;
        statusText: HTMLElement | null;
        container: HTMLElement | null;
    }>({
        open: null,
        high: null,
        low: null,
        close: null,
        change: null,
        changePercent: null,
        statusDot: null,
        statusText: null,
        container: null
    });

    // Build indicator cache when candles change
    useEffect(() => {
        if (!candles.length) return;

        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        if (!indicators.length) {
            indicatorCacheRef.current = [];
            return;
        }

        const prices = candles.map(c => c.close);

        indicatorCacheRef.current = indicators
            .filter((config: any) => config.visible)
            .map((config: any) => {
                const period = config.params?.period || 14;
                let results: any = [];

                try {
                    switch (config.type) {
                        case 'EMA':
                            results = calculateEMA(prices, period);
                            break;
                        case 'HMA':
                            results = calculateHullMA(prices, period);
                            break;
                        case 'RSI':
                            results = calculateRSI(prices, period);
                            break;
                        case 'MACD': {
                            const { fast = 12, slow = 26, signal = 9 } = config.params || {};
                            results = calculateMACD(prices, fast, slow, signal);
                            break;
                        }
                    }
                } catch (e) {
                    console.error(`Indicator calc error (${config.type}):`, e);
                }

                return {
                    type: config.type,
                    id: config.id,
                    period,
                    color: config.color,
                    pane: config.pane,
                    results,
                    params: config.params
                };
            });

        lastCandleCountRef.current = candles.length;
    }, [candles.length, chartId, candles[candles.length - 2]?.time]);

    // Subscribe to crosshair events (bypass React)
    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        const container = containerRef.current;

        // Cache DOM refs
        ohlcRefsRef.current = {
            open: container.querySelector('[data-ohlc="open"]'),
            high: container.querySelector('[data-ohlc="high"]'),
            low: container.querySelector('[data-ohlc="low"]'),
            close: container.querySelector('[data-ohlc="close"]'),
            change: container.querySelector('[data-ohlc="change"]'),
            changePercent: container.querySelector('[data-ohlc="change-percent"]'),
            statusDot: container.querySelector('[data-status="dot"]'),
            statusText: container.querySelector('[data-status="text"]'),
            container: container.querySelector('[data-legend-container]')
        };

        const formatPrice = (p: number) => {
            if (p === 0) return '0.00';
            if (p < 0.0001) return p.toExponential(4);
            if (p < 1) return p.toFixed(5);
            if (p < 100) return p.toFixed(3);
            return p.toFixed(2);
        };

        const updateDOM = (activeIndex: number, isLive: boolean, currentPrice?: number) => {
            if (!candles.length) return;

            const refs = ohlcRefsRef.current;
            const candle = candles[activeIndex] || candles[candles.length - 1];
            if (!candle) return;

            let { open, high, low, close } = candle;

            // Apply realtime price for live mode
            if (isLive && currentPrice) {
                close = currentPrice;
                if (close > high) high = close;
                if (close < low) low = close;
            }

            const changeValue = close - open;
            const changePercent = open !== 0 ? (changeValue / open * 100) : 0;
            const isPositive = changeValue >= 0;
            const color = isPositive ? '#22c55e' : '#ef4444';

            // Update OHLC values
            if (refs.open) refs.open.textContent = formatPrice(open);
            if (refs.high) refs.high.textContent = formatPrice(high);
            if (refs.low) refs.low.textContent = formatPrice(low);
            if (refs.close) {
                refs.close.textContent = formatPrice(close);
                refs.close.style.color = color;
            }
            if (refs.change) {
                refs.change.textContent = (isPositive ? '+' : '') + formatPrice(changeValue);
                refs.change.style.color = color;
            }
            if (refs.changePercent) {
                refs.changePercent.textContent = `(${changePercent.toFixed(2)}%)`;
                refs.changePercent.style.color = color;
            }

            // Update status indicator
            if (refs.statusDot) {
                refs.statusDot.className = isLive
                    ? 'w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)] animate-pulse'
                    : 'w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]';
            }
            if (refs.statusText) {
                refs.statusText.textContent = isLive ? 'Live' : 'Historical';
                refs.statusText.className = isLive
                    ? 'text-[8px] font-black text-green-500 uppercase tracking-widest opacity-80'
                    : 'text-[8px] font-black text-amber-500 uppercase tracking-widest italic';
            }
            if (refs.container) {
                refs.container.className = isLive
                    ? 'flex flex-col gap-1.5 p-2 backdrop-blur-md border rounded-lg shadow-xl min-w-fit transition-colors duration-200 bg-zinc-950/60 border-white/5'
                    : 'flex flex-col gap-1.5 p-2 backdrop-blur-md border rounded-lg shadow-xl min-w-fit transition-colors duration-200 bg-amber-500/10 border-amber-500/40';
            }

            // Update indicator values
            const indicatorContainer = container.querySelector('[data-indicators]');
            if (indicatorContainer) {
                indicatorCacheRef.current
                    .filter(ind => ind.pane !== 'subchart')
                    .forEach(ind => {
                        const el = indicatorContainer.querySelector(`[data-indicator-id="${ind.id}"]`);
                        if (!el) return;

                        const valueEl = el.querySelector('[data-indicator-value]');
                        if (!valueEl) return;

                        if (ind.type === 'MACD') {
                            const results = ind.results as { macd: number[]; signal: number[]; histogram: number[] };
                            const idx = Math.min(activeIndex, results.macd.length - 1);
                            const macdVal = results.macd[idx];
                            const sigVal = results.signal[idx];
                            const histVal = results.histogram[idx];

                            const spans = valueEl.querySelectorAll('span');
                            if (spans[0]) spans[0].textContent = isNaN(macdVal) ? '-' : macdVal.toFixed(2);
                            if (spans[1]) spans[1].textContent = isNaN(sigVal) ? '-' : sigVal.toFixed(2);
                            if (spans[2]) {
                                spans[2].textContent = isNaN(histVal) ? '-' : histVal.toFixed(2);
                                spans[2].style.color = histVal >= 0 ? '#26a69a' : '#ef5350';
                            }
                        } else {
                            const results = ind.results as number[];
                            const idx = Math.min(activeIndex, results.length - 1);
                            const val = results[idx];
                            valueEl.textContent = isNaN(val) ? '···' : val.toFixed(2);
                        }
                    });
            }
        };

        // Binary search for candle index
        const findCandleIndex = (targetTime: number): number => {
            let low = 0;
            let high = candles.length - 1;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const midTime = typeof candles[mid].time === 'object'
                    ? (candles[mid].time as any).timestamp
                    : Number(candles[mid].time);

                if (midTime === targetTime) return mid;
                if (midTime < targetTime) low = mid + 1;
                else high = mid - 1;
            }

            return candles.length - 1;
        };

        // Handle crosshair events
        const handleCrosshair = (e: CustomEvent) => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

            rafIdRef.current = requestAnimationFrame(() => {
                const { time, sourceId } = e.detail || {};

                if (!time || sourceId !== chartId) {
                    // Show live data
                    const currentPrice = useMarketStore.getState().tickers[symbol]?.price;
                    updateDOM(candles.length - 1, true, currentPrice);
                    return;
                }

                const lastCandle = candles[candles.length - 1];
                const lastTime = typeof lastCandle?.time === 'object'
                    ? (lastCandle.time as any).timestamp
                    : Number(lastCandle?.time);

                const isLive = time === lastTime;
                const activeIndex = findCandleIndex(time);
                const currentPrice = isLive ? useMarketStore.getState().tickers[symbol]?.price : undefined;

                updateDOM(activeIndex, isLive, currentPrice);
            });
        };

        // Initial render
        const currentPrice = useMarketStore.getState().tickers[symbol]?.price;
        updateDOM(candles.length - 1, true, currentPrice);

        // Subscribe to custom event (bypasses React)
        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        // Also subscribe to ticker updates for live mode
        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[symbol]?.price,
            (price) => {
                // Only update if in live mode (no crosshair active)
                const crosshair = useMarketStore.getState().crosshairPoint;
                if (!crosshair?.time) {
                    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = requestAnimationFrame(() => {
                        updateDOM(candles.length - 1, true, price);
                    });
                }
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubTicker();
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [chartId, symbol, interval, source, candles.length, containerRef]);
}
