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
            const nextRange = {
                from: Math.max(-0.5, startIndex - 1),
                to: endIndex + 2,
            };

            chart.timeScale().setVisibleLogicalRange(nextRange);
            subchartChartRef.current?.timeScale().setVisibleLogicalRange(nextRange);
            timescaleChartRef.current?.timeScale().setVisibleLogicalRange(nextRange);
            chart.priceScale('right').applyOptions({ autoScale: true });
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

        priceContainer.addEventListener('dblclick', onPriceDblClick);
        subchartContainer.addEventListener('dblclick', onSubchartDblClick);
        timescaleContainer.addEventListener('dblclick', onTimescaleDblClick);

        const handleForegroundResync = () => {
            const chart = priceChartRef.current;
            if (!chart || !isAutoScrollEnabledRef?.current) return;

            const recover = () => {
                const priceChart = priceChartRef.current;
                const subChart = subchartChartRef.current;
                const footerChart = timescaleChartRef.current;
                if (!priceChart) return;

                if (priceContainer.clientWidth > 0 && priceContainer.clientHeight > 0) {
                    priceChart.resize(priceContainer.clientWidth, priceContainer.clientHeight, true);
                }
                if (subChart && subchartContainer.clientWidth > 0 && subchartContainer.clientHeight > 0) {
                    subChart.resize(subchartContainer.clientWidth, subchartContainer.clientHeight, true);
                }
                if (footerChart && timescaleContainer.clientWidth > 0 && timescaleContainer.clientHeight > 0) {
                    footerChart.resize(timescaleContainer.clientWidth, timescaleContainer.clientHeight, true);
                }

                const total = candles.length;
                if (total > 0) {
                    const nextRange = {
                        from: Math.max(0, total - (window.innerWidth < 768 ? 40 : 80)),
                        to: total + 5,
                    };
                    priceChart.timeScale().setVisibleLogicalRange(nextRange);
                    subChart?.timeScale().setVisibleLogicalRange(nextRange);
                    footerChart?.timeScale().setVisibleLogicalRange(nextRange);
                } else {
                    priceChart.timeScale().scrollToRealTime();
                }
                priceChart.priceScale('right').applyOptions({ autoScale: true });
            };

            requestAnimationFrame(recover);
            window.setTimeout(recover, 120);
        };
        window.addEventListener('chart-foreground-resync', handleForegroundResync as EventListener);

        return () => {
            priceContainer.removeEventListener('dblclick', onPriceDblClick);
            subchartContainer.removeEventListener('dblclick', onSubchartDblClick);
            timescaleContainer.removeEventListener('dblclick', onTimescaleDblClick);
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
