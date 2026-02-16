
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
    drawing: ManualLineData,
    timeScale: any,
    series: ISeriesApi<any>
): { x: number, y: number } | null {
    if (!drawing.points || drawing.points.length === 0) return null;

    let x = null, y = null;

    if (drawing.type === 'horizontal-line') {
        const py = series.priceToCoordinate(drawing.points[0].price);
        if (py !== null) {
            // Match the renderer logic: 50px from right edge
            // Note: Renderer uses (width - 50) * pixelRatio.
            // Here we return logical coordinates, so just width - 50.
            x = timeScale.width() - 50;
            y = py;
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
