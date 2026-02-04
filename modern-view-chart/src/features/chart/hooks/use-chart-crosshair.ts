import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

export function useChartCrosshair(
    chartId: string,
    chartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>
) {
    const { broadcastCrosshair } = useCrossWindowSync();
    const internalUpdateRef = useRef(false);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;
        const chart = chartRef.current;
        const series = seriesRef.current;

        chart.subscribeCrosshairMove((param) => {
            const state = useMarketStore.getState();
            if (internalUpdateRef.current || !state.isCrosshairSyncEnabled) return;

            if (!param || !param.point || !param.time) {
                if (state.crosshairPoint?.sourceId === chartId) state.syncCrosshair(null);
                return;
            }

            const price = series.coordinateToPrice(param.point.y);
            if (price === null) return;

            const point = { time: param.time as number, price: price as number, sourceId: chartId };
            state.syncCrosshair(point);
            broadcastCrosshair(point);
        });

        const unsubscribe = useMarketStore.subscribe(
            (state) => state.crosshairPoint,
            (point) => {
                if (!useMarketStore.getState().isCrosshairSyncEnabled || !point || point.sourceId === chartId) {
                    if (!point && useMarketStore.getState().isCrosshairSyncEnabled) {
                        internalUpdateRef.current = true;
                        chart.clearCrosshairPosition();
                        setTimeout(() => internalUpdateRef.current = false, 10);
                    }
                    return;
                }

                internalUpdateRef.current = true;
                try {
                    if (point.price !== null && point.time !== null) {
                        chart.setCrosshairPosition(point.price, point.time as any, series);
                    } else {
                        chart.clearCrosshairPosition();
                    }
                } finally {
                    setTimeout(() => internalUpdateRef.current = false, 10);
                }
            }
        );

        return () => unsubscribe();
    }, [chartId]);
}
