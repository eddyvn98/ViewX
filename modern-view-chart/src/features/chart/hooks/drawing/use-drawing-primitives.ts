
import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { ManualLinePrimitive, ManualLineData } from '../../logic/manual-line-primitive';
import { FibonacciPrimitive } from '../../logic/fibonacci-primitive';
import { ManualRectanglePrimitive } from '../../logic/manual-rectangle-primitive';
import { calculateFibLevels } from '../../utils/fib-utils';

const EMPTY_ARRAY: any[] = [];

export function useDrawingPrimitives(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<any> | null,
    isReady: boolean
) {
    const chartDrawings = useMarketStore(state => state.chartDrawings[chartId] || EMPTY_ARRAY);
    const selectedDrawingId = useMarketStore(state => state.selectedDrawingId);

    const primitivesRef = useRef<Record<string, any>>({});

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
            if (drawing.type.startsWith('fib-')) {
                const levels = calculateFibLevels(drawing.type, drawing.points, drawing.params);
                primitive.update({
                    points: drawing.points,
                    type: drawing.type as any,
                    levels,
                    color: drawing.color,
                    lineWidth: drawing.lineWidth,
                    lineStyle: drawing.lineStyle,
                    selected: selectedDrawingId === drawing.id
                });
            } else {
                primitive.update({
                    points: drawing.points,
                    type: drawing.type as any,
                    color: drawing.color,
                    lineWidth: drawing.lineWidth,
                    lineStyle: drawing.lineStyle,
                    selected: selectedDrawingId === drawing.id
                });
            }
        });
    }, [chartDrawings, series, isReady, selectedDrawingId]);
}
