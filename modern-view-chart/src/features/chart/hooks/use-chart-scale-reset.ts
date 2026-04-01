import { useEffect } from 'react';
import { IChartApi } from 'lightweight-charts';
import type { Candle } from '@/lib/store/types';

/**
 * Hook to handle double-click events on chart scales to reset them,
 * mimicking TradingView behavior.
 */
export function useChartScaleReset(
    priceChartRef: React.RefObject<IChartApi | null>,
    subchartChartRef: React.RefObject<IChartApi | null>,
    timescaleChartRef: React.RefObject<IChartApi | null>,
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>,
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>,
    isAutoScrollEnabledRef?: React.RefObject<boolean>,
    candles: Candle[] = []
) {
    useEffect(() => {
        const priceContainer = priceContainerRef.current;
        const subchartContainer = subchartContainerRef.current;
        const timescaleContainer = timescaleContainerRef.current;

        if (!priceContainer || !subchartContainer || !timescaleContainer) return;

        const focusRecentCandles = (count = 50) => {
            const chart = priceChartRef.current;
            if (!chart) return;

            const total = candles.length;
            if (total <= 0) {
                chart.timeScale().fitContent();
                chart.timeScale().scrollToRealTime();
                if (isAutoScrollEnabledRef) isAutoScrollEnabledRef.current = true;
                return;
            }

            const startIndex = Math.max(0, total - count);
            const endIndex = total - 1;
            const slice = candles.slice(startIndex, endIndex + 1);

            let minLow = Number.POSITIVE_INFINITY;
            let maxHigh = Number.NEGATIVE_INFINITY;
            for (const candle of slice) {
                const low = Number(candle.low);
                const high = Number(candle.high);
                if (Number.isFinite(low) && low < minLow) minLow = low;
                if (Number.isFinite(high) && high > maxHigh) maxHigh = high;
            }

            chart.timeScale().setVisibleLogicalRange({
                from: Math.max(-0.5, startIndex - 1),
                to: endIndex + 2,
            });

            const priceScale = chart.priceScale('right') as { setVisibleRange?: (range: { from: number; to: number }) => void };
            if (Number.isFinite(minLow) && Number.isFinite(maxHigh) && maxHigh > minLow) {
                const padding = (maxHigh - minLow) * 0.08;
                priceScale.setVisibleRange?.({
                    from: minLow - padding,
                    to: maxHigh + padding,
                });
            } else {
                chart.priceScale('right').applyOptions({ autoScale: true });
            }
            if (isAutoScrollEnabledRef) isAutoScrollEnabledRef.current = true;
        };

        /**
         * Resets price scale to auto when double-clicked on the right side.
         */
        const handlePriceScaleDblClick = (
            chartRef: React.RefObject<IChartApi | null>,
            container: HTMLElement,
            allowAutoScaleReset: boolean
        ) => (e: MouseEvent) => {
            const chart = chartRef.current;
            if (!chart) return;

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = container.clientWidth;

            // Use a slightly larger threshold (100px) since minimumWidth is 80px
            // This ensures clicks on the right scale area are caught
            if (x > width - 100) {
                e.stopPropagation();
                if (allowAutoScaleReset) {
                    chart.priceScale('right').applyOptions({ autoScale: true });
                }
            } else {
                // If double click NOT on the price scale, reset the time scale (TradingView behavior)
                handleTimeScaleDblClick(e);
            }
        };

        /**
         * Resets time scale to default zoom/position when double-clicked on the timescale footer.
         */
        const handleTimeScaleDblClick = (e: MouseEvent) => {
            e.stopPropagation();
            focusRecentCandles(50);
        };

        const onPriceDblClick = handlePriceScaleDblClick(priceChartRef, priceContainer, true);
        const onSubchartDblClick = handlePriceScaleDblClick(subchartChartRef, subchartContainer, false);
        const onTimescaleDblClick = handleTimeScaleDblClick;

        const createTouchDoubleTapHandler = (
            chartRef: React.RefObject<IChartApi | null>,
            container: HTMLElement,
            allowAutoScaleReset: boolean
        ) => {
            let lastTapAt = 0;
            let lastTapX = 0;
            let lastTapY = 0;
            return (e: TouchEvent) => {
                if (e.touches.length !== 1) return;
                const touch = e.touches[0];
                if (!touch) return;
                const now = Date.now();
                const deltaMs = now - lastTapAt;
                const deltaX = Math.abs(touch.clientX - lastTapX);
                const deltaY = Math.abs(touch.clientY - lastTapY);
                const isDoubleTap = deltaMs > 0 && deltaMs <= 320 && deltaX <= 24 && deltaY <= 24;

                lastTapAt = now;
                lastTapX = touch.clientX;
                lastTapY = touch.clientY;

                if (!isDoubleTap) return;

                const chart = chartRef.current;
                if (!chart) return;
                const rect = container.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const width = container.clientWidth;

                e.preventDefault();
                e.stopPropagation();

                if (x > width - 100) {
                    if (allowAutoScaleReset) {
                        chart.priceScale('right').applyOptions({ autoScale: true });
                    }
                    return;
                }

                focusRecentCandles(50);
            };
        };

        const onPriceTouchStart = createTouchDoubleTapHandler(priceChartRef, priceContainer, true);
        const onSubchartTouchStart = createTouchDoubleTapHandler(subchartChartRef, subchartContainer, false);
        const onTimescaleTouchStart = createTouchDoubleTapHandler(timescaleChartRef, timescaleContainer, false);

        priceContainer.addEventListener('dblclick', onPriceDblClick);
        subchartContainer.addEventListener('dblclick', onSubchartDblClick);
        timescaleContainer.addEventListener('dblclick', onTimescaleDblClick);
        priceContainer.addEventListener('touchstart', onPriceTouchStart, { passive: false });
        subchartContainer.addEventListener('touchstart', onSubchartTouchStart, { passive: false });
        timescaleContainer.addEventListener('touchstart', onTimescaleTouchStart, { passive: false });

        const handleForegroundResync = () => {
            const chart = priceChartRef.current;
            if (!chart || !isAutoScrollEnabledRef?.current) return;
            chart.timeScale().scrollToRealTime();
        };
        window.addEventListener('chart-foreground-resync', handleForegroundResync as EventListener);

        return () => {
            priceContainer.removeEventListener('dblclick', onPriceDblClick);
            subchartContainer.removeEventListener('dblclick', onSubchartDblClick);
            timescaleContainer.removeEventListener('dblclick', onTimescaleDblClick);
            priceContainer.removeEventListener('touchstart', onPriceTouchStart);
            subchartContainer.removeEventListener('touchstart', onSubchartTouchStart);
            timescaleContainer.removeEventListener('touchstart', onTimescaleTouchStart);
            window.removeEventListener('chart-foreground-resync', handleForegroundResync as EventListener);
        };
    }, [
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef,
        isAutoScrollEnabledRef,
        candles,
    ]);
}
