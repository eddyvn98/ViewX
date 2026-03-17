
import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { ManualLinePrimitive } from '../../logic/manual-line-primitive';
import { FibonacciPrimitive } from '../../logic/fibonacci-primitive';
import { ManualRectanglePrimitive } from '../../logic/manual-rectangle-primitive';
import { calculateFibLevels } from '../../utils/fib-utils';
import { Candle } from '@/lib/store/types';

const EMPTY_ARRAY: Candle[] = [];
export type DrawingPrimitive = ManualLinePrimitive | FibonacciPrimitive | ManualRectanglePrimitive;

export function useDrawingPrimitives(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<'Candlestick'> | null,
    isReady: boolean
) {
    const chartDrawings = useMarketStore(state => state.chartDrawings[chartId] || EMPTY_ARRAY);
    const selectedDrawingId = useMarketStore(state => state.selectedDrawingId);

    const primitivesRef = useRef<Record<string, DrawingPrimitive>>({});

    // Handle existing drawings
    useEffect(() => {
        if (!series || !isReady) return;

        // Remove primitives that are no longer in state
        const drawingIds = chartDrawings.map(d => d.id);
        Object.keys(primitivesRef.current).forEach(id => {
            if (!drawingIds.includes(id)) {
                series.detachPrimitive(primitivesRef.current[id]);
                delete primitivesRef.current[id];
            }
        });

        // Update or create primitives
        chartDrawings.forEach(drawing => {
            if (!drawing.visible) {
                if (primitivesRef.current[drawing.id]) {
                    series.detachPrimitive(primitivesRef.current[drawing.id]);
                    delete primitivesRef.current[drawing.id];
                }
                return;
            }

            let primitive = primitivesRef.current[drawing.id];

            if (!primitive) {
                if (drawing.type.startsWith('fib-')) {
                    primitive = new FibonacciPrimitive(null);
                } else if (drawing.type === 'rectangle') {
                    primitive = new ManualRectanglePrimitive();
                } else {
                    primitive = new ManualLinePrimitive();
                }
                series.attachPrimitive(primitive);
                primitivesRef.current[drawing.id] = primitive;
            }

            // Update primitive based on type
            const primitiveUpdater = primitive as { update: (payload: Record<string, unknown>) => void };
            if (drawing.type.startsWith('fib-')) {
                const levels = calculateFibLevels(drawing.type, drawing.points, drawing.params, drawing.color);
                primitiveUpdater.update({
                    points: drawing.points,
                    type: drawing.type,
                    levels,
                    color: drawing.color,
                    lineWidth: drawing.lineWidth,
                    lineStyle: drawing.lineStyle,
                    selected: selectedDrawingId === drawing.id
                });
            } else {
                primitiveUpdater.update({
                    points: drawing.points,
                    type: drawing.type,
                    color: drawing.color,
                    lineWidth: drawing.lineWidth,
                    lineStyle: drawing.lineStyle,
                    selected: selectedDrawingId === drawing.id
                });
            }
        });
    }, [chartDrawings, series, isReady, selectedDrawingId]);

    return { primitivesRef };
}
