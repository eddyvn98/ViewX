import { Time, ISeriesApi } from 'lightweight-charts';
import { ManualLineData } from './manual-line/manual-line-primitive-core';

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
            y = 80; // Moved down further to avoid Legend obstruction
        }
    } else if (drawing.type === 'crosshair') {
        const px = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        const py = series.priceToCoordinate(drawing.points[0].price);
        if (px !== null && py !== null) {
            x = px + 20;
            y = py - 20;
        }
    } else if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
        const x1 = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        const y1 = series.priceToCoordinate(drawing.points[0].price);
        const x2 = timeScale.timeToCoordinate(drawing.points[1].time as Time);
        const y2 = series.priceToCoordinate(drawing.points[1].price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            x = (x1 + x2) / 2;
            y = (y1 + y2) / 2;
        }
    } else if (drawing.type.startsWith('fib-') && drawing.points.length >= 2) {
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

export { ManualLinePrimitive } from './manual-line/manual-line-primitive-core';
export type { ManualLineData } from './manual-line/manual-line-primitive-core';
