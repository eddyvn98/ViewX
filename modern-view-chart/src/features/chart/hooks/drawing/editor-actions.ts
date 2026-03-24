import { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import { calculateFibLevels } from '../../utils/fib-utils';
import { toSec } from '../../utils/time-utils';
import { findSnapPoint } from '../../utils/snap-utils';
import { Candle } from '@/lib/store/types';
import { distanceToSegment } from '../../utils/geometry-utils';
import { useMarketStore } from '@/lib/store';
import { DrawingConfig, DrawingPoint } from '@/lib/store/types';

interface DragArgs {
    chartId: string;
    chart: IChartApi;
    series: ISeriesApi<'Candlestick'>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isDrawing: boolean;
    selectedDrawingId: string | null;
    chartDrawings: DrawingConfig[];
    primitivesRef?: React.MutableRefObject<Record<string, unknown>>;
    candles: Candle[];
    snapToCandle: boolean;
    updateDrawing: (chartId: string, drawingId: string, changes: Partial<DrawingConfig>) => void;
    stateRef?: {
        isDragging: boolean;
        isDraggingBody: boolean;
        draggedPointIndex: number;
        draggedDrawingId: string | null;
        dragStartPos: { x: number; y: number } | null;
        dragStartPoints: DrawingPoint[] | null;
        draggedFinalPoints: DrawingPoint[] | null;
        lastLogicalDelta: number;
        lastPriceDelta: number;
    };
}

export function createDrawingDragHandlers(args: DragArgs) {
    const {
        chartId, chart, series, containerRef, isDrawing, selectedDrawingId, chartDrawings, primitivesRef, candles, snapToCandle, updateDrawing, stateRef,
    } = args;

    const state = stateRef ?? {
        isDragging: false,
        isDraggingBody: false,
        draggedPointIndex: -1,
        draggedDrawingId: null as string | null,
        dragStartPos: null as { x: number; y: number } | null,
        dragStartPoints: null as DrawingPoint[] | null,
        draggedFinalPoints: null as DrawingPoint[] | null,
        lastLogicalDelta: 0,
        lastPriceDelta: 0,
    };

    const handleCrosshairMove = (param: MouseEventParams) => {
        void param;
    };

    const handleDragStart = (param: MouseEventParams) => {
        if (isDrawing || !param.point) return;

        const x = param.point.x;
        const y = param.point.y;

        const findNearAnchor = (p: { time: number; price: number }[]) => {
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

        // 1. Check for Anchor Move (selected drawing only)
        if (selectedDrawingId) {
            const drawing = chartDrawings.find(d => d.id === selectedDrawingId);
            if (drawing && !drawing.locked) {
                const anchorIndex = findNearAnchor(drawing.points);
                if (anchorIndex !== -1) {
                    state.isDragging = true;
                    state.isDraggingBody = false;
                    state.draggedPointIndex = anchorIndex;
                    state.draggedDrawingId = selectedDrawingId;
                    state.dragStartPos = { x, y };
                    state.draggedFinalPoints = [...drawing.points];

                    chart.applyOptions({
                        handleScroll: { pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
                        handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false },
                    });
                    return;
                }
            }
        }

        // 2. Check for Body Move (any visible drawing)
        let hitDrawingId: string | null = null;
        for (let i = chartDrawings.length - 1; i >= 0; i--) {
            const drawing = chartDrawings[i];
            if (drawing.visible === false || drawing.locked) continue;

            let isHit = false;
            const timeScale = chart.timeScale();

            if (drawing.type === 'trend-line' || drawing.type === 'horizontal-line') {
                const p1 = drawing.points[0];
                const p2 = drawing.type === 'horizontal-line' ? { time: 0, price: p1.price } : drawing.points[1];
                const x1 = timeScale.timeToCoordinate(p1.time as Time);
                const y1 = series.priceToCoordinate(p1.price);
                const x2 = drawing.type === 'horizontal-line' ? (timeScale.width() + 1000) : timeScale.timeToCoordinate(p2.time as Time);
                const y2 = series.priceToCoordinate(p2.price);

                if (y1 !== null) {
                    if (drawing.type === 'horizontal-line') {
                        if (Math.abs(y - y1) < 15) isHit = true;
                    } else if (x1 !== null && x2 !== null && y2 !== null) {
                        if (distanceToSegment(x, y, x1, y1, x2, y2) < 15) isHit = true;
                    }
                }
            } else if (drawing.type === 'vertical-line' && drawing.points.length >= 1) {
                const xAt = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                if (xAt !== null && Math.abs(x - xAt) < 15) isHit = true;
            } else if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
                const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                const y1 = series.priceToCoordinate(drawing.points[0].price);
                const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
                const y2 = series.priceToCoordinate(drawing.points[1].price);
                if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
                    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
                    if (x >= minX - 10 && x <= maxX + 10 && y >= minY - 10 && y <= maxY + 10) isHit = true;
                }
            } else if (drawing.type.startsWith('fib-')) {
                if (findNearAnchor(drawing.points) !== -1) isHit = true;
                if (!isHit && drawing.points.length >= 2) {
                    const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                    const y1 = series.priceToCoordinate(drawing.points[0].price);
                    const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
                    const y2 = series.priceToCoordinate(drawing.points[1].price);
                    if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                        if (distanceToSegment(x, y, x1, y1, x2, y2) < 20) isHit = true;
                    }
                }
            }

            if (isHit) {
                hitDrawingId = drawing.id;
                break;
            }
        }

        if (hitDrawingId) {
            const drawing = chartDrawings.find(d => d.id === hitDrawingId);
            if (!drawing) return;
            state.isDragging = true;
            state.isDraggingBody = true;
            state.draggedDrawingId = hitDrawingId;
            state.dragStartPos = { x, y };
            state.dragStartPoints = JSON.parse(JSON.stringify(drawing.points));
            state.draggedFinalPoints = [...drawing.points];

            if (selectedDrawingId !== hitDrawingId) {
                useMarketStore.getState().setSelectedDrawing(hitDrawingId);
            }

            chart.applyOptions({
                handleScroll: { pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
                handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false },
            });
            return;
        }

        if (containerRef.current) containerRef.current.style.cursor = 'grab';
    };

    const handleDragMove = (param: MouseEventParams) => {
        if (!state.isDragging || !state.draggedDrawingId || !param.point) return;

        const targetX = param.point.x;
        const targetY = param.point.y;
        const timeScale = chart.timeScale();
        const drawingId = state.draggedDrawingId;
        const drawing = chartDrawings.find(d => d.id === drawingId);
        const primitive = primitivesRef?.current?.[drawingId];
        if (!drawing || !primitive) return;
        const primitiveUpdater = primitive as { update: (payload: Record<string, unknown>) => void };

        if (state.isDraggingBody) {
            if (!state.dragStartPos || !state.dragStartPoints) return;

            const startLogical = timeScale.coordinateToLogical(state.dragStartPos.x);
            const currentLogical = timeScale.coordinateToLogical(targetX);
            const startPrice = series.coordinateToPrice(state.dragStartPos.y);
            const currentPrice = series.coordinateToPrice(targetY);

            if (startLogical !== null && currentLogical !== null && startPrice !== null && currentPrice !== null) {
                const logicalDelta = Math.round(currentLogical - startLogical);
                const priceDelta = currentPrice - startPrice;

                const newPoints = state.dragStartPoints.map(p => {
                    const px = timeScale.timeToCoordinate(p.time as Time);
                    if (px === null) return p;
                    const pLogical = timeScale.coordinateToLogical(px);
                    if (pLogical === null) return p;

                    const movedLogical = pLogical + logicalDelta;
                    const movedTime = (timeScale as { logicalToTime?: (logical: number) => Time | null }).logicalToTime?.(movedLogical);

                    return {
                        time: movedTime ? toSec(movedTime) : p.time,
                        price: p.price + priceDelta
                    };
                });

                state.draggedFinalPoints = newPoints;
                if (drawing.type.startsWith('fib-')) {
                    const levels = calculateFibLevels(drawing.type, newPoints, drawing.params, drawing.color);
                    primitiveUpdater.update({ points: newPoints, type: drawing.type, levels, color: drawing.color, lineWidth: drawing.lineWidth, lineStyle: drawing.lineStyle, selected: true });
                } else {
                    primitiveUpdater.update({ points: newPoints, type: drawing.type, color: drawing.color, lineWidth: drawing.lineWidth, lineStyle: drawing.lineStyle, selected: true });
                }
            }
        } else {
            const time = timeScale.coordinateToTime(targetX);
            let newPrice = series.coordinateToPrice(targetY) as number | null;

            if (snapToCandle && time && newPrice !== null) {
                const snap = findSnapPoint(targetY, time, candles, series, 20);
                if (snap) newPrice = snap.price;
            }

            if (time && newPrice !== null && state.draggedFinalPoints) {
                const newPoints = [...state.draggedFinalPoints];
                newPoints[state.draggedPointIndex] = { time: toSec(time as Time), price: newPrice };
                state.draggedFinalPoints = newPoints;

                if (drawing.type.startsWith('fib-')) {
                    const levels = calculateFibLevels(drawing.type, newPoints, drawing.params, drawing.color);
                    primitiveUpdater.update({ points: newPoints, type: drawing.type, levels, color: drawing.color, lineWidth: drawing.lineWidth, lineStyle: drawing.lineStyle, selected: true });
                } else {
                    primitiveUpdater.update({ points: newPoints, type: drawing.type, color: drawing.color, lineWidth: drawing.lineWidth, lineStyle: drawing.lineStyle, selected: true });
                }
            }
        }
    };

    const handleDragEnd = () => {
        if (state.isDragging) {
            if (state.draggedDrawingId && state.draggedFinalPoints) {
                updateDrawing(chartId, state.draggedDrawingId, { points: state.draggedFinalPoints });
            }

            state.isDragging = false;
            state.isDraggingBody = false;
            state.draggedPointIndex = -1;
            state.draggedDrawingId = null;
            state.dragStartPos = null;
            state.dragStartPoints = null;
            state.draggedFinalPoints = null;

            chart.applyOptions({
                handleScroll: { pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
                handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
            });
        }
        if (containerRef.current) containerRef.current.style.cursor = 'default';
    };

    return { handleCrosshairMove, handleDragStart, handleDragMove, handleDragEnd };
}
