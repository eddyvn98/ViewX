import { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import { distanceToSegment, getDeleteButtonPosition } from '../../utils/geometry-utils';
import { calculateFibLevels } from '../../utils/fib-utils';
import { ManualLineData } from '../../logic/manual-line-primitive';
import { DrawingConfig } from '@/lib/store/types';

interface SelectionArgs {
    chartId: string;
    chart: IChartApi;
    series: ISeriesApi<'Candlestick'>;
    isDrawing: boolean;
    selectedDrawingId: string | null;
    chartDrawings: DrawingConfig[];
    removeDrawing: (chartId: string, id: string) => void;
    setSelectedDrawing: (id: string | null) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function createDrawingSelectionHandler(args: SelectionArgs) {
    const { chartId, chart, series, isDrawing, selectedDrawingId, chartDrawings, removeDrawing, setSelectedDrawing, containerRef } = args;

    return (param: MouseEventParams) => {
        if (isDrawing || !param.point) return;

        const x = param.point.x;
        const y = param.point.y;

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

        let clickedId: string | null = null;
        for (let i = chartDrawings.length - 1; i >= 0; i--) {
            const drawing = chartDrawings[i];
            if (drawing.visible === false) continue;

            // Use context coordinate x/y directly from the pointer/click.
            // Using timeScale.timeToCoordinate(param.time) would snap the hit-test to bar centers,
            // making it impossible to select lines in "dead zones" (no bars) or with sub-bar precision.
            const clickX = x;

            if (drawing.type.startsWith('fib-')) {
                const levels = calculateFibLevels(drawing.type, drawing.points, drawing.params);
                for (const level of levels) {
                    const levelY = series.priceToCoordinate(level.price);
                    if (levelY !== null && Math.abs(y - levelY) < 10) {
                        clickedId = drawing.id;
                        break;
                    }
                }
            } else if (drawing.type === 'trend-line' || drawing.type === 'horizontal-line') {
                if (drawing.points.length >= (drawing.type === 'horizontal-line' ? 1 : 2)) {
                    const p1 = drawing.points[0];
                    const p2 = drawing.type === 'horizontal-line' ? { time: 0, price: p1.price } : drawing.points[1];

                    const timeScale = chart.timeScale();
                    const x1 = timeScale.timeToCoordinate(p1.time as Time);
                    const y1 = series.priceToCoordinate(p1.price);
                    const x2 = drawing.type === 'horizontal-line' ? (timeScale.width() + 1000) : timeScale.timeToCoordinate(p2.time as Time);
                    const y2 = series.priceToCoordinate(p2.price);

                    if (y1 !== null && (drawing.type === 'horizontal-line' || (x1 !== null && x2 !== null && y2 !== null))) {
                        if (drawing.type === 'horizontal-line') {
                            if (Math.abs(y - y1) < 15) clickedId = drawing.id;
                        } else {
                            const dist = distanceToSegment(clickX, y, x1!, y1, x2!, y2!);
                            if (dist < 10) clickedId = drawing.id;
                        }
                    }
                }
            } else if (drawing.type === 'vertical-line' && drawing.points.length >= 1) {
                const timeScale = chart.timeScale();
                const xAt = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                if (xAt !== null && Math.abs(clickX - xAt) < 10) clickedId = drawing.id;
            } else if (drawing.type === 'crosshair' && drawing.points.length >= 1) {
                const timeScale = chart.timeScale();
                const xAt = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                const yAt = series.priceToCoordinate(drawing.points[0].price);
                if (xAt !== null && yAt !== null) {
                    const isNearVertical = Math.abs(clickX - xAt) < 10;
                    const isNearHorizontal = Math.abs(y - yAt) < 10;
                    if (isNearVertical || isNearHorizontal) clickedId = drawing.id;
                }
            } else if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
                const timeScale = chart.timeScale();
                const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                const y1 = series.priceToCoordinate(drawing.points[0].price);
                const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
                const y2 = series.priceToCoordinate(drawing.points[1].price);

                if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
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

                    if (isNearBorder || (isInside && drawing.params?.fillColor !== 'transparent')) clickedId = drawing.id;
                }
            }

            if (clickedId) break;
        }

        setSelectedDrawing(clickedId);
    };
}
