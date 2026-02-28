
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
import { Candle } from '@/lib/store/types';

export function useDrawingCreation(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<any> | null,
    isReady: boolean,
    currentTool: string,
    containerRef: React.RefObject<HTMLDivElement | null>,
    candles: Candle[]
) {
    const draftPrimitiveRef = useRef<any>(null);
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

                const pointsForDraft = [...tempPoints, { time, price }];
                const color = THEME_COLORS[themeColor] || '#2962FF';

                const draftColor = isSnapped ? '#FFCC00' : color;
                const lineWidth = isSnapped ? 2 : 1;

                if (currentTool.startsWith('fib-')) {
                    const draftLevels = calculateFibLevels(currentTool, pointsForDraft, {
                        enabledLevels: { "1": true, "0.618": true, "0.5": true, "0.382": true, "0": true }
                    }, color);
                    draftPrimitiveRef.current?.update({
                        points: pointsForDraft,
                        type: currentTool as any,
                        levels: draftLevels,
                        color: draftColor,
                        lineWidth: lineWidth,
                        lineStyle: 'dashed'
                    });
                } else {
                    draftPrimitiveRef.current?.update({
                        points: pointsForDraft,
                        type: currentTool as any,
                        color: draftColor,
                        lineWidth: lineWidth,
                        lineStyle: 'dashed'
                    });
                }
            }
            rafId = requestAnimationFrame(updateDraft);
        };

        const handleNativeMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            mousePosRef.x = e.clientX - rect.left;
            mousePosRef.y = e.clientY - rect.top;
            mousePosRef.changed = true;
        };

        container.addEventListener('mousemove', handleNativeMouseMove);
        rafId = requestAnimationFrame(updateDraft);

        return () => {
            container.removeEventListener('mousemove', handleNativeMouseMove);
            cancelAnimationFrame(rafId);
        };
    }, [chart, series, currentTool, tempPoints, themeColor, candles, snapToCandle]);

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
            finishDrawing(chartId);
        }
    }, [currentTool, addDrawingPoint, tempPoints, finishDrawing, chartId]);

    return { handleCreationClick };
}
