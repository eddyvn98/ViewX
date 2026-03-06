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
    const indicatorCacheLengthRef = useRef(0);
    const crosshairRafRef = useRef<number | null>(null);
    const ohlcRefsRef = useRef<OHLCRefs | null>(null);
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement; value: HTMLElement; spans?: NodeListOf<HTMLSpanElement> }>>(new Map());
    const lastUpdateAtRef = useRef(0);
    const lastIsLiveRef = useRef<boolean | null>(null);
    const lastTooltipStateRef = useRef<{ left: number; top: number; visible: boolean; time: number | null }>({
        left: Number.NaN,
        top: Number.NaN,
        visible: false,
        time: null
    });

    useEffect(() => {
        if (!candles.length || !containerRef.current || !symbol || !interval || !source) return;

        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        indicatorCacheRef.current = calculateIndicators(candles, indicators);
        indicatorCacheLengthRef.current = candles.length;
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);
    }, [candles, chartId, symbol, interval, source, containerRef]);

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        ohlcRefsRef.current = getOHLCRefs(containerRef.current);
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);

        const normalizedSymbol = getNormalizedSymbol(symbol);
        const tickerKey = `${source}:${normalizedSymbol}`;
        const symbolDigits = getSymbolDigits(symbol);
        const getIndicatorsFor = (rawCandles: Candle[]) => {
            if (rawCandles.length !== indicatorCacheLengthRef.current) {
                const latestIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
                indicatorCacheRef.current = calculateIndicators(rawCandles, latestIndicators);
                indicatorCacheLengthRef.current = rawCandles.length;
                indicatorRefsRef.current = getIndicatorRefs(containerRef.current!, indicatorCacheRef.current);
            }
            return indicatorCacheRef.current;
        };

        const handleCrosshair = (e: CustomEvent<CrosshairEventDetail>) => {
            const { time, sourceId, sourcePane, point, sourceRect, sourceEvent } = e.detail || {};

            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            crosshairRafRef.current = requestAnimationFrame(() => {
                if (!containerRef.current) return;

                if (sourceId !== chartId || !time || !point || point.x === undefined || point.y === undefined) {
                    if (lastTooltipStateRef.current.visible) {
                        containerRef.current.style.opacity = '0';
                        lastTooltipStateRef.current.visible = false;
                        lastTooltipStateRef.current.time = null;
                    }
                    return;
                }

                if (sourcePane !== 'price') return;

                if (!lastTooltipStateRef.current.visible) {
                    containerRef.current.style.opacity = '1';
                    lastTooltipStateRef.current.visible = true;
                }

                const isMobile = window.innerWidth < 768;
                const isTouchInput = Boolean(sourceEvent?.isTouch || sourceEvent?.pointerType === 'touch');
                const tooltipWidth = containerRef.current.offsetWidth || 70;
                const tooltipHeight = containerRef.current.offsetHeight || 50;
                const offsetX = isTouchInput ? 18 : 15;
                const offsetY = isTouchInput ? 18 : 15;

                const anchorX = typeof sourceRect?.left === 'number'
                    ? sourceRect.left + point.x
                    : typeof sourceEvent?.clientX === 'number'
                    ? sourceEvent.clientX
                    : lastTooltipStateRef.current.left;
                const anchorY = typeof sourceRect?.top === 'number'
                    ? sourceRect.top + point.y
                    : typeof sourceEvent?.clientY === 'number'
                    ? sourceEvent.clientY
                    : lastTooltipStateRef.current.top;

                if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return;

                let left = anchorX + offsetX;
                let top = anchorY + offsetY;

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                if (isTouchInput) {
                    const preferLeftSide = anchorX > viewportWidth * 0.55;
                    const preferAboveCrosshair = anchorY > tooltipHeight + 24;

                    left = preferLeftSide
                        ? anchorX - tooltipWidth - offsetX
                        : anchorX + offsetX;
                    top = preferAboveCrosshair
                        ? anchorY - tooltipHeight - offsetY
                        : anchorY + offsetY;
                } else if (isMobile) {
                    left = anchorX - (tooltipWidth / 2);
                }

                if (left + tooltipWidth > viewportWidth) {
                    left = viewportWidth - tooltipWidth - 5;
                }
                if (left < 5) left = 5;

                if (top + tooltipHeight > viewportHeight) {
                    top = anchorY - tooltipHeight - (isMobile ? 20 : 15);
                }
                if (top < 5) top = 5;

                if (lastTooltipStateRef.current.left !== left || lastTooltipStateRef.current.top !== top) {
                    containerRef.current.style.left = '0px';
                    containerRef.current.style.top = '0px';
                    containerRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                    lastTooltipStateRef.current.left = left;
                    lastTooltipStateRef.current.top = top;
                }

                const fresh = getFreshCandles(symbol, interval, source, chartType);
                const activeIndex = findCandleIndex(time, fresh.raw);
                const isLastCandle = activeIndex === fresh.raw.length - 1;
                const currentIndicators = getIndicatorsFor(fresh.raw);
                if (lastTooltipStateRef.current.time === time && !isLastCandle) return;
                lastTooltipStateRef.current.time = time;

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
                    symbolDigits,
                    false
                );
            });
        };

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                if (!symbol || !interval || !source) return;
                const fresh = getFreshCandles(symbol, interval, source, chartType);
                indicatorCacheRef.current = calculateIndicators(fresh.raw, newIndicators || []);
                indicatorCacheLengthRef.current = fresh.raw.length;
                if (containerRef.current) {
                    indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);
                }
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubIndicators();
            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
        };
    }, [chartId, symbol, interval, source, chartType, containerRef, candles.length]);
}
