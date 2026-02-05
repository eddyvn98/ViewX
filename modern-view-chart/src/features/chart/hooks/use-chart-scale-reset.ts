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
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>
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

            // Get the actual width of the price scale
            const priceScale = chart.priceScale('right');
            const scaleWidth = priceScale.width();

            // Check if click is within the right price scale area (slightly more generous hit test)
            if (x > width - scaleWidth - 4) {
                console.log("[Double Click] Resetting scale. Width:", scaleWidth);
                priceScale.applyOptions({
                    autoScale: true,
                });
            }
        };

        /**
         * Resets time scale to fit content when double-clicked on the timescale footer.
         */
        const handleTimeScaleDblClick = () => {
            const chart = priceChartRef.current;
            if (chart) {
                chart.timeScale().fitContent();
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
