
import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, Time, MouseEventParams } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { ManualLinePrimitive, ManualLineData } from '../../logic/manual-line-primitive';
import { FibonacciPrimitive } from '../../logic/fibonacci-primitive';
import { ManualRectanglePrimitive } from '../../logic/manual-rectangle-primitive';
import { calculateFibLevels } from '../../utils/fib-utils';
import { toSec } from '../../utils/time-utils';

export function useDrawingCreation(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<any> | null,
    isReady: boolean,
    currentTool: string
) {
    const draftPrimitiveRef = useRef<any>(null);
    const lastSnappedPointRef = useRef<{ time: Time; price: number } | null>(null);
    const tempPoints = useMarketStore(state => state.tempPoints);
    const addDrawingPoint = useMarketStore(state => state.addDrawingPoint);
    const finishDrawing = useMarketStore(state => state.finishDrawing);

    // Draft Preview Logic
    useEffect(() => {
        if (!chart || !series || currentTool === 'none') {
            if (draftPrimitiveRef.current) {
                series?.detachPrimitive(draftPrimitiveRef.current);
                draftPrimitiveRef.current = null;
            }
            return;
        }

        if (!draftPrimitiveRef.current) {
            if (currentTool.startsWith('fib-')) {
                draftPrimitiveRef.current = new FibonacciPrimitive(null);
            } else if (currentTool === 'rectangle') {
                draftPrimitiveRef.current = new ManualRectanglePrimitive();
            } else {
                draftPrimitiveRef.current = new ManualLinePrimitive();
            }
            series.attachPrimitive(draftPrimitiveRef.current);
        }

        const handleCrosshairMove = (param: MouseEventParams) => {
            if (!param.time || !param.point || !series) return;

            const price = series.coordinateToPrice(param.point.y);
            if (price === null) return;

            // Snap Logic (Simple Candle Snap)
            // Ideally we'd scan visible candles, but for now just use current time/price
            // The original logic had complex snap, let's keep it simple for now or import helper
            // Re-implementing simplified snap for dependency reduction
            const time = param.time;
            const snappedPrice = price; // Placeholder for snap logic

            lastSnappedPointRef.current = { time, price: snappedPrice };

            // Update Draft Primitive
            const pointsForDraft = [...tempPoints, lastSnappedPointRef.current];
            const isFib = currentTool.startsWith('fib-');

            if (isFib) {
                const draftLevels = calculateFibLevels(currentTool, pointsForDraft, {
                    enabledLevels: { "1": true, "0.618": true, "0.5": true, "0.382": true, "0": true }
                });
                draftPrimitiveRef.current?.update({
                    points: pointsForDraft,
                    type: currentTool as any,
                    levels: draftLevels,
                    color: '#2962FF',
                    lineWidth: 1,
                    lineStyle: 'dashed'
                });
            } else {
                draftPrimitiveRef.current?.update({
                    points: pointsForDraft,
                    type: currentTool as any,
                    color: '#2962FF',
                    lineWidth: 1,
                    lineStyle: 'dashed'
                });
            }
        };

        chart.subscribeCrosshairMove(handleCrosshairMove);
        return () => {
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
        };
    }, [chart, series, currentTool, tempPoints]);

    // Click Handler (Placement)
    const handleCreationClick = (param: MouseEventParams) => {
        if (currentTool === 'none' || !lastSnappedPointRef.current) return;

        const { time, price } = lastSnappedPointRef.current;
        addDrawingPoint({ time: toSec(time), price });

        // Check if finished
        const pointsNeeded = currentTool === 'horizontal-line' ? 1 : 2;
        // tempPoints is BEFORE this click, so +1
        if (tempPoints.length + 1 >= pointsNeeded) {
            finishDrawing(chartId);
            // Reset logic handled by store usually, but we might need to ensure cleanup
        }
    };

    return { handleCreationClick };
}
