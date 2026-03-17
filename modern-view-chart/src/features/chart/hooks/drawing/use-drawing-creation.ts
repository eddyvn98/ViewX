
import { useEffect, useRef, useCallback } from 'react';
import { IChartApi, ISeriesApi, Time, MouseEventParams } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { ManualLinePrimitive } from '../../logic/manual-line-primitive';
import { FibonacciPrimitive } from '../../logic/fibonacci-primitive';
import { ManualRectanglePrimitive } from '../../logic/manual-rectangle-primitive';
import { calculateFibLevels } from '../../utils/fib-utils';
import { toSec } from '../../utils/time-utils';
import { THEME_COLORS } from '@/lib/constants/colors';

import { findSnapPoint } from '../../utils/snap-utils';
import { Candle, DrawingTool } from '@/lib/store/types';

type DraftUpdatePayload = {
    points: Array<{ time: Time; price: number }>;
    type: DrawingTool;
    levels?: unknown;
    color: string;
    lineWidth: number;
    lineStyle: 'dashed';
};

export function useDrawingCreation(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<'Candlestick'> | null,
    isReady: boolean,
    currentTool: DrawingTool,
    containerRef: React.RefObject<HTMLDivElement | null>,
    candles: Candle[],
    context?: { symbol?: string; interval?: string; source?: 'BINANCE' | 'MT5' }
) {
    const draftPrimitiveRef = useRef<ManualLinePrimitive | FibonacciPrimitive | ManualRectanglePrimitive | null>(null);
    const lastSnappedPointRef = useRef<{ time: Time; price: number } | null>(null);
    const tempPoints = useMarketStore(state => state.tempPoints);
    const snapToCandle = useMarketStore(state => state.snapToCandle); // Get snap state
    const addDrawingPoint = useMarketStore(state => state.addDrawingPoint);
    const finishDrawing = useMarketStore(state => state.finishDrawing);
    const themeColor = useMarketStore(state => state.themeColor);

    // Draft Preview Logic (Ultra-Low Latency via Native Events + RAF)
    useEffect(() => {
        if (!chart || !series || currentTool === 'none' || !containerRef.current) {
            if (draftPrimitiveRef.current) {
                series?.detachPrimitive(draftPrimitiveRef.current);
                draftPrimitiveRef.current = null;
            }
            return;
        }

        const container = containerRef.current;
        const mousePosRef = { x: 0, y: 0, changed: false };
        let rafId: number;

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

        const updateDraft = () => {
            if (!mousePosRef.changed) {
                rafId = requestAnimationFrame(updateDraft);
                return;
            }
            mousePosRef.changed = false;

            const timeScale = chart.timeScale();
            const time = timeScale.coordinateToTime(mousePosRef.x);
            const rawPrice = series.coordinateToPrice(mousePosRef.y);

            if (time && rawPrice !== null) {
                let price = rawPrice as number;
                let isSnapped = false;

                if (snapToCandle) {
                    const snap = findSnapPoint(mousePosRef.y, time, candles, series, 20);
                    if (snap) {
                        price = snap.price;
                        isSnapped = true;
                    }
                }

                lastSnappedPointRef.current = { time, price };

                const baseDraftPoints = tempPoints.map((point) => ({ time: point.time as Time, price: point.price }));
                const pointsForDraft = [...baseDraftPoints, { time, price }];
                const color = THEME_COLORS[themeColor] || '#2962FF';

                const draftColor = isSnapped ? '#FFCC00' : color;
                const lineWidth = isSnapped ? 2 : 1;

                const primitiveUpdater = draftPrimitiveRef.current as { update: (payload: DraftUpdatePayload) => void } | null;
                if (!primitiveUpdater) {
                    rafId = requestAnimationFrame(updateDraft);
                    return;
                }

                if (currentTool.startsWith('fib-')) {
                    const draftLevels = calculateFibLevels(currentTool, pointsForDraft, {
                        enabledLevels: { "1": true, "0.618": true, "0.5": true, "0.382": true, "0": true }
                    }, color);
                    primitiveUpdater.update({
                        points: pointsForDraft,
                        type: currentTool,
                        levels: draftLevels,
                        color: draftColor,
                        lineWidth: lineWidth,
                        lineStyle: 'dashed'
                    });
                } else {
                    primitiveUpdater.update({
                        points: pointsForDraft,
                        type: currentTool,
                        color: draftColor,
                        lineWidth: lineWidth,
                        lineStyle: 'dashed'
                    });
                }
            }
            rafId = requestAnimationFrame(updateDraft);
        };

        const updatePointerPosition = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect();
            mousePosRef.x = clientX - rect.left;
            mousePosRef.y = clientY - rect.top;
            mousePosRef.changed = true;
        };

        const handleMouseMove = (e: MouseEvent) => {
            updatePointerPosition(e.clientX, e.clientY);
        };

        const handlePointerDown = (e: PointerEvent) => {
            updatePointerPosition(e.clientX, e.clientY);
        };

        const handlePointerMove = (e: PointerEvent) => {
            updatePointerPosition(e.clientX, e.clientY);
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('pointerdown', handlePointerDown);
        container.addEventListener('pointermove', handlePointerMove);
        rafId = requestAnimationFrame(updateDraft);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('pointerdown', handlePointerDown);
            container.removeEventListener('pointermove', handlePointerMove);
            cancelAnimationFrame(rafId);
        };
    }, [chart, series, currentTool, tempPoints, themeColor, candles, snapToCandle, containerRef]);

    // Click Handler (Placement)
    const handleCreationClick = useCallback((param: MouseEventParams) => {
        void param; // Still use lastSnappedPointRef for precision/snapping
        if (currentTool === 'none' || !lastSnappedPointRef.current) return;

        const { time, price } = lastSnappedPointRef.current;
        addDrawingPoint({ time: toSec(time), price });

        // Check if finished
        const pointsNeeded = (currentTool === 'horizontal-line' || currentTool === 'vertical-line' || currentTool === 'crosshair') ? 1 : 2;
        // tempPoints is BEFORE this click, so +1
        if (tempPoints.length + 1 >= pointsNeeded) {
            finishDrawing(chartId, context);
        }
    }, [currentTool, addDrawingPoint, tempPoints, finishDrawing, chartId, context]);

    return { handleCreationClick };
}
