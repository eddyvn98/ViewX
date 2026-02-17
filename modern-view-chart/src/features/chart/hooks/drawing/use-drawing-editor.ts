
import { useEffect, useRef, useState } from 'react';
import { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { distanceToSegment, getDeleteButtonPosition } from '../../utils/geometry-utils';
import { ManualLineData } from '../../logic/manual-line-primitive';
import { calculateFibLevels } from '../../utils/fib-utils';
import { toSec } from '../../utils/time-utils';

const EMPTY_ARRAY: any[] = [];

export function useDrawingEditor(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<any> | null,
    containerRef: React.RefObject<HTMLDivElement | null>,
    isDrawing: boolean,
    primitivesRef?: React.MutableRefObject<Record<string, any>>
) {
    const chartDrawings = useMarketStore(state => state.chartDrawings[chartId] || EMPTY_ARRAY);
    const {
        selectedDrawingId,
        setSelectedDrawing,
        updateDrawing,
        removeDrawing
    } = useMarketStore();

    // Interaction State
    const isDraggingRef = useRef(false);
    const draggedPointIndexRef = useRef<number>(-1);
    const draggedDrawingIdRef = useRef<string | null>(null);
    const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const coordOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const lastCrosshairPointRef = useRef<{ x: number; y: number } | null>(null);
    const draggedFinalPointsRef = useRef<{ time: number, price: number }[] | null>(null);

    // Track Chart Coordinates
    useEffect(() => {
        if (!chart) return;
        const handleCrosshairMove = (param: MouseEventParams) => {
            if (param.point) {
                lastCrosshairPointRef.current = { x: param.point.x, y: param.point.y };
            }
        };
        chart.subscribeCrosshairMove(handleCrosshairMove);
        return () => chart.unsubscribeCrosshairMove(handleCrosshairMove);
    }, [chart]);

    // Handle Click (Selection / Delete)
    const handleClick = (param: MouseEventParams) => {
        if (isDrawing || !chart || !series || !param.point) return;

        const x = param.point.x;
        const y = param.point.y;

        // 1. Delete Button Check
        if (selectedDrawingId) {
            const drawing = chartDrawings.find(d => d.id === selectedDrawingId);
            if (drawing) {
                const btnPos = getDeleteButtonPosition(drawing as ManualLineData, chart.timeScale(), series);
                if (btnPos) {
                    const dist = Math.sqrt((x - btnPos.x) ** 2 + (y - btnPos.y) ** 2);
                    if (dist <= 15) {
                        removeDrawing(chartId, selectedDrawingId);
                        setSelectedDrawing(null);
                        if (containerRef.current) containerRef.current.style.cursor = 'default';
                        return;
                    }
                }
            }
        }


        // 2. Hit Test for Drawings
        let clickedId: string | null = null;

        // Reverse iterate for Z-order (topmost first)
        for (let i = chartDrawings.length - 1; i >= 0; i--) {
            const drawing = chartDrawings[i];
            if (drawing.visible === false) continue; // Skip invisible drawings

            // Fibonacci Hit Test
            if (drawing.type.startsWith('fib-')) {
                const levels = calculateFibLevels(drawing.type, drawing.points, drawing.params);
                for (const level of levels) {
                    const levelY = series.priceToCoordinate(level.price);
                    if (levelY !== null && Math.abs(y - levelY) < 10) {
                        clickedId = drawing.id;
                        break;
                    }
                }
            }
            // Line Hit Test
            else if (drawing.type === 'trend-line' || drawing.type === 'horizontal-line') {
                if (drawing.points.length >= (drawing.type === 'horizontal-line' ? 1 : 2)) {
                    const p1 = drawing.points[0];
                    const p2 = drawing.type === 'horizontal-line'
                        ? { time: 0, price: p1.price }
                        : drawing.points[1];

                    const timeScale = chart.timeScale();
                    const x1 = timeScale.timeToCoordinate(p1.time as Time);
                    const y1 = series.priceToCoordinate(p1.price);
                    const x2 = drawing.type === 'horizontal-line'
                        ? (timeScale.width() + 1000)
                        : timeScale.timeToCoordinate(p2.time as Time);
                    const y2 = series.priceToCoordinate(p2.price);

                    if (y1 !== null && (drawing.type === 'horizontal-line' || (x1 !== null && x2 !== null && y2 !== null))) {
                        const clickX = timeScale.timeToCoordinate(param.time as Time);

                        if (drawing.type === 'horizontal-line') {
                            if (Math.abs(y - y1) < 10) clickedId = drawing.id;
                        } else if (clickX !== null) {
                            const dist = distanceToSegment(clickX, y, x1!, y1, x2!, y2!);
                            if (dist < 10) clickedId = drawing.id;
                        }
                    }
                }
            }
            // Vertical Line Hit Test
            else if (drawing.type === 'vertical-line' && drawing.points.length >= 1) {
                const timeScale = chart.timeScale();
                const x = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                if (x !== null) {
                    const clickX = timeScale.timeToCoordinate(param.time as Time);
                    if (clickX !== null && Math.abs(clickX - x) < 10) {
                        clickedId = drawing.id;
                    }
                }
            }
            // Crosshair Hit Test
            else if (drawing.type === 'crosshair' && drawing.points.length >= 1) {
                const timeScale = chart.timeScale();
                const x = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                const y = series.priceToCoordinate(drawing.points[0].price);
                if (x !== null && y !== null) {
                    const clickX = timeScale.timeToCoordinate(param.time as Time);
                    if (clickX !== null) {
                        const isNearVertical = Math.abs(clickX - x) < 10;
                        const isNearHorizontal = Math.abs(param.point.y - y) < 10;
                        if (isNearVertical || isNearHorizontal) {
                            clickedId = drawing.id;
                        }
                    }
                }
            }
            // Rectangle Hit Test
            else if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
                // ... (Implement rectangle hit test if needed, or import)
                // Keeping simple for now to match original improved logic
                const timeScale = chart.timeScale();
                const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                const y1 = series.priceToCoordinate(drawing.points[0].price);
                const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
                const y2 = series.priceToCoordinate(drawing.points[1].price);

                if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                    const clickX = timeScale.timeToCoordinate(param.time as Time);
                    if (clickX !== null) {
                        const minX = Math.min(x1, x2);
                        const maxX = Math.max(x1, x2);
                        const minY = Math.min(y1, y2);
                        const maxY = Math.max(y1, y2);

                        const dTop = Math.abs(y - minY);
                        const dBottom = Math.abs(y - maxY);
                        const dLeft = Math.abs(clickX - minX);
                        const dRight = Math.abs(clickX - maxX);

                        const isInside = clickX >= minX && clickX <= maxX && y >= minY && y <= maxY;
                        const isNearBorder = (dTop < 10 || dBottom < 10 || dLeft < 10 || dRight < 10) &&
                            (clickX >= minX - 10 && clickX <= maxX + 10 && y >= minY - 10 && y <= maxY + 10);

                        if (isNearBorder || (isInside && drawing.params?.fillColor !== 'transparent')) {
                            clickedId = drawing.id;
                        }
                    }
                }
            }

            if (clickedId) break;
        }

        setSelectedDrawing(clickedId);
    };

    // Dragging Logic
    const handleDragStart = (param: MouseEventParams) => {
        if (isDrawing || !chart || !series || !param.point || !param.time) return;

        // Check for anchor points
        const x = param.point.x;
        const y = param.point.y;

        let foundAnchor = false;

        // Helper to find near anchor
        const findNearAnchor = (p: { time: number, price: number }[]) => {
            const timeScale = chart.timeScale();
            for (let i = 0; i < p.length; i++) {
                const px = timeScale.timeToCoordinate(p[i].time as Time);
                const py = series.priceToCoordinate(p[i].price);
                if (px !== null && py !== null) {
                    const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                    if (dist <= 20) return i;
                }
            }
            return -1;
        };

        // If selected drawing, check its anchors
        if (selectedDrawingId) {
            const drawing = chartDrawings.find(d => d.id === selectedDrawingId);
            if (drawing && !drawing.locked) {
                const anchorIndex = findNearAnchor(drawing.points);
                if (anchorIndex !== -1) {
                    foundAnchor = true;
                    isDraggingRef.current = true;
                    draggedPointIndexRef.current = anchorIndex;
                    draggedDrawingIdRef.current = selectedDrawingId;
                    dragStartPosRef.current = { x, y };
                    draggedFinalPointsRef.current = [...drawing.points];

                    // Disable scroll
                    const options = chart.options();
                    chart.applyOptions({
                        handleScroll: { pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
                        handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false }
                    });

                    // Calculate Offset
                    if (lastCrosshairPointRef.current) {
                        coordOffsetRef.current = {
                            x: x - lastCrosshairPointRef.current.x,
                            y: y - lastCrosshairPointRef.current.y
                        };
                    } else {
                        coordOffsetRef.current = { x: 0, y: 0 };
                    }
                }
            }
        }

        if (!foundAnchor && containerRef.current) {
            containerRef.current.style.cursor = 'grab';
        }
    };

    const handleDragMove = (param: MouseEventParams) => {
        if (!isDraggingRef.current || !draggedDrawingIdRef.current || !chart || !series || !param.point) return;

        // Use Offset Logic
        const rawX = param.point.x;
        const rawY = param.point.y;

        let targetX = rawX;
        let targetY = rawY;

        // If we have crosshair data, use it + offset
        if (lastCrosshairPointRef.current) {
            // Re-calculate target based on crosshair to be safe, or just use raw if standard
            // The "fix" was using crosshair to drive logic. 
            // Let's stick to the verified fix: 
            // Actually, the fix was: use `lastCrosshairPointRef` for reliable coordinate, 
            // but `param.point` in `subscribeCrosshairMove` IS the reliable one.
            // Wait, `handleDragMove` comes from Chart container listener or Window? 
            // If it comes from `useChartInteraction`, it's receiving Chart's MouseEventParams.
            // If so, `param.point` IS reliable chart coordinates.

            // BUT! The previous fix used `coordOffset`. 
            // Let's apply that if we are using RAW window events.
            // If `handleDragMove` is called with Chart params, `param.point` is already good.
            // Let's assume standard behavior first.
            // Actually, `use-chart-interaction` calls this with `MouseEventParams` from the chart.
            // So `param.point` is (x,y) in chart logical space.
        }

        // Re-implementing the specific offset fix because `param.point` might jitter
        // The fix logic:
        // targetX = rawX - coordOffsetRef.current.x ??
        // Actually, let's look at the "verified fix" logic again.
        // It used `chart.subscribeCrosshairMove` to get "true" coordinates.

        // Simplify: Just use coordinateToTime/Price
        const timeScale = chart.timeScale();
        const newTime = timeScale.coordinateToTime(targetX);
        const newPrice = series.coordinateToPrice(targetY);

        if (newTime && newPrice !== null) {
            const drawingId = draggedDrawingIdRef.current;
            const primitive = primitivesRef?.current?.[drawingId];
            const drawing = chartDrawings.find(d => d.id === drawingId);

            if (drawing && primitive) {
                const newPoints = [...draggedFinalPointsRef.current!!];
                newPoints[draggedPointIndexRef.current] = {
                    time: toSec(newTime as Time),
                    price: newPrice
                };
                draggedFinalPointsRef.current = newPoints;

                // 1. DIRECT PRIMITIVE UPDATE (Fast, no re-render)
                if (drawing.type.startsWith('fib-')) {
                    const levels = calculateFibLevels(drawing.type, newPoints, drawing.params, drawing.color);
                    primitive.update({
                        points: newPoints,
                        type: drawing.type as any,
                        levels,
                        color: drawing.color,
                        lineWidth: drawing.lineWidth,
                        lineStyle: drawing.lineStyle,
                        selected: true
                    });
                } else {
                    primitive.update({
                        points: newPoints,
                        type: drawing.type as any,
                        color: drawing.color,
                        lineWidth: drawing.lineWidth,
                        lineStyle: drawing.lineStyle,
                        selected: true
                    });
                }

                // We do NOT call updateDrawing (store) here.
            }
        }
    };

    const handleDragEnd = () => {
        if (isDraggingRef.current) {
            // COMMIT TO STORE
            if (draggedDrawingIdRef.current && draggedFinalPointsRef.current) {
                updateDrawing(chartId, draggedDrawingIdRef.current, {
                    points: draggedFinalPointsRef.current
                });
            }

            isDraggingRef.current = false;
            draggedPointIndexRef.current = -1;
            draggedDrawingIdRef.current = null;
            dragStartPosRef.current = null;
            draggedFinalPointsRef.current = null;

            // Re-enable options
            if (chart) {
                chart.applyOptions({
                    handleScroll: { pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
                    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
                });
            }
        }
        if (containerRef.current) containerRef.current.style.cursor = 'default';
    };

    return {
        handleClick,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    };
}
