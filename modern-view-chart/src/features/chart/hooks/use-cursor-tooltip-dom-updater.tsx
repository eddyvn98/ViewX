'use client';

import React, { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getOHLCRefs, getIndicatorRefs, OHLCRefs } from '../logic/legend-renderer';
import { updateLegendDirect } from './legend-dom-updater.render';
import {
    CrosshairEventDetail,
    getFreshCandles,
    findCandleIndex,
    getTickerPrice,
    getSymbolDigits,
    getNormalizedSymbol
} from './legend-dom-updater.helpers';

export interface CursorTooltipDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
    chartType?: string;
}

export function useCursorTooltipDOMUpdater(
    containerRef: React.RefObject<HTMLDivElement | null>,
    { chartId, symbol, interval, source, candles, chartType = 'candles' }: CursorTooltipDOMUpdaterProps
) {
    const indicatorCacheRef = useRef<IndicatorCache[]>([]);
    const crosshairRafRef = useRef<number | null>(null);
    const ohlcRefsRef = useRef<OHLCRefs | null>(null);
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement; value: HTMLElement; spans?: NodeListOf<HTMLSpanElement> }>>(new Map());
    const lastUpdateAtRef = useRef(0);
    const lastIsLiveRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (!candles.length || !containerRef.current || !symbol || !interval || !source) return;

        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        indicatorCacheRef.current = calculateIndicators(candles, indicators);
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);
    }, [candles, chartId, symbol, interval, source, containerRef]);

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        ohlcRefsRef.current = getOHLCRefs(containerRef.current);
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);

        const normalizedSymbol = getNormalizedSymbol(symbol);
        const tickerKey = `${source}:${normalizedSymbol}`;
        const symbolDigits = getSymbolDigits(symbol);
        const mousePos = { x: 0, y: 0 };

        const handleMouseMove = (e: MouseEvent) => {
            mousePos.x = e.clientX;
            mousePos.y = e.clientY;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                mousePos.x = e.touches[0].clientX;
                mousePos.y = e.touches[0].clientY;
            }
        };

        const handleCrosshair = (e: CustomEvent<CrosshairEventDetail>) => {
            const { time, sourceId, point, sourceEvent } = e.detail || {};

            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            crosshairRafRef.current = requestAnimationFrame(() => {
                if (!containerRef.current) return;

                if (sourceId !== chartId || !time || !point || point.x === undefined || point.y === undefined) {
                    containerRef.current.style.opacity = '0';
                    return;
                }

                containerRef.current.style.opacity = '1';

                const isMobile = window.innerWidth < 768;
                const tooltipWidth = containerRef.current.offsetWidth || 70;
                const tooltipHeight = containerRef.current.offsetHeight || 50;
                // Larger offset on mobile to avoid finger coverage
                const offsetX = isMobile ? 0 : 15;
                const offsetY = isMobile ? -70 : 15;

                const pointerX = typeof sourceEvent?.clientX === 'number' ? sourceEvent.clientX : mousePos.x;
                const pointerY = typeof sourceEvent?.clientY === 'number' ? sourceEvent.clientY : mousePos.y;

                let left = pointerX + offsetX;
                let top = pointerY + offsetY;

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // Mobile specific: center tooltip horizontally relative to touch point
                if (isMobile) {
                    left = pointerX - (tooltipWidth / 2);
                }

                if (left + tooltipWidth > viewportWidth) {
                    left = viewportWidth - tooltipWidth - 5;
                }
                if (left < 5) left = 5;

                if (top + tooltipHeight > viewportHeight) {
                    top = pointerY - tooltipHeight - (isMobile ? 20 : 15);
                }
                if (top < 5) top = 5;

                containerRef.current.style.left = '0px';
                containerRef.current.style.top = '0px';
                containerRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;

                const fresh = getFreshCandles(symbol, interval, source, chartType);
                const activeIndex = findCandleIndex(time, fresh.raw);
                const isLastCandle = activeIndex === fresh.raw.length - 1;
                const currentIndicators = calculateIndicators(fresh.raw, useMarketStore.getState().chartIndicators[chartId] || []);

                updateLegendDirect(
                    activeIndex,
                    isLastCandle,
                    isLastCandle ? getTickerPrice(tickerKey, normalizedSymbol) : undefined,
                    fresh.raw,
                    fresh.display,
                    currentIndicators,
                    ohlcRefsRef.current,
                    lastUpdateAtRef,
                    lastIsLiveRef,
                    chartType,
                    chartId,
                    indicatorRefsRef.current,
                    symbolDigits
                );
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchstart', handleTouchMove, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                if (!symbol || !interval || !source) return;
                const fresh = getFreshCandles(symbol, interval, source, chartType);
                indicatorCacheRef.current = calculateIndicators(fresh.raw, newIndicators || []);
                if (containerRef.current) {
                    indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);
                }
            }
        );

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchstart', handleTouchMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubIndicators();
            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
        };
    }, [chartId, symbol, interval, source, chartType, containerRef, candles.length]);
}
