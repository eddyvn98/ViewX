
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { ManualLineData } from '../logic/manual-line-primitive';

/**
 * Calculates the shortest distance from a point (x, y) to a line segment defined by (x1, y1) and (x2, y2).
 */
export function distanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) // in case of 0 length line
        param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    }
    else if (param > 1) {
        xx = x2;
        yy = y2;
    }
    else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the position for the delete button (visual 'X') on a selected drawing.
 */
export function getDeleteButtonPosition(
    drawing: any,
    timeScale: any,
    series: ISeriesApi<any>
): { x: number; y: number } | null {
    if (!drawing.points || drawing.points.length === 0) return null;

    let x = null;
    let y = null;

    if (drawing.type === 'horizontal-line') {
        const py = series.priceToCoordinate(drawing.points[0].price);
        if (py !== null) {
            x = timeScale.width() - 50;
            y = py;
        }
    } else if (drawing.type === 'vertical-line') {
        const px = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        if (px !== null) {
            x = px;
            y = 80; // Match renderer (y=80) to avoid legend
        }
    } else if (drawing.type === 'crosshair') {
        const px = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        const py = series.priceToCoordinate(drawing.points[0].price);
        if (px !== null && py !== null) {
            x = px + 20;
            y = py - 20;
        }
    } else if ((drawing.type === 'rectangle' || drawing.type.startsWith('fib-')) && drawing.points.length >= 2) {
        const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        const y1 = series.priceToCoordinate(drawing.points[0].price);
        const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
        const y2 = series.priceToCoordinate(drawing.points[1].price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            x = (x1 + x2) / 2;
            y = (y1 + y2) / 2;
        }
    } else if (drawing.points.length >= 2) {
        const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        const y1 = series.priceToCoordinate(drawing.points[0].price);
        const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
        const y2 = series.priceToCoordinate(drawing.points[1].price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            x = (x1 + x2) / 2;
            y = (y1 + y2) / 2;
        }
    }

    if (x !== null && y !== null) return { x, y };
    return null;
}
