import { useEffect } from 'react';
import { IChartApi } from 'lightweight-charts';

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
    isAutoScrollEnabledRef?: React.RefObject<boolean>
) {
    useEffect(() => {
        const priceContainer = priceContainerRef.current;
        const subchartContainer = subchartContainerRef.current;
        const timescaleContainer = timescaleContainerRef.current;

        if (!priceContainer || !subchartContainer || !timescaleContainer) return;

        /**
         * Resets price scale to auto when double-clicked on the right side.
         */
        const handlePriceScaleDblClick = (chartRef: React.RefObject<IChartApi | null>, container: HTMLElement) => (e: MouseEvent) => {
            const chart = chartRef.current;
            if (!chart) return;

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = container.clientWidth;

            // Use a slightly larger threshold (100px) since minimumWidth is 80px
            // This ensures clicks on the right scale area are caught
            if (x > width - 100) {
                e.stopPropagation();
                chart.priceScale('right').applyOptions({ autoScale: true });
            } else {
                // If double click NOT on the price scale, reset the time scale (TradingView behavior)
                handleTimeScaleDblClick(e);
            }
        };

        /**
         * Resets time scale to default zoom/position when double-clicked on the timescale footer.
         */
        const handleTimeScaleDblClick = (e: MouseEvent) => {
            const chart = priceChartRef.current;
            if (chart) {
                e.stopPropagation();
                // We use the main chart for fit calculations because it doesn't have 
                // the extra future points that the footer chart has.
                chart.timeScale().fitContent();
                chart.timeScale().scrollToRealTime();
                if (isAutoScrollEnabledRef) {
                    isAutoScrollEnabledRef.current = true;
                }
            }
        };

        const onPriceDblClick = handlePriceScaleDblClick(priceChartRef, priceContainer);
        const onSubchartDblClick = handlePriceScaleDblClick(subchartChartRef, subchartContainer);
        const onTimescaleDblClick = handleTimeScaleDblClick;

        priceContainer.addEventListener('dblclick', onPriceDblClick);
        subchartContainer.addEventListener('dblclick', onSubchartDblClick);
        timescaleContainer.addEventListener('dblclick', onTimescaleDblClick);

        return () => {
            priceContainer.removeEventListener('dblclick', onPriceDblClick);
            subchartContainer.removeEventListener('dblclick', onSubchartDblClick);
            timescaleContainer.removeEventListener('dblclick', onTimescaleDblClick);
        };
    }, [
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef
    ]);
}

