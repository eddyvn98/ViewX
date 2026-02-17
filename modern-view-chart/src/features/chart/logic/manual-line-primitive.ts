import {
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Time,
    IChartApi,
    ISeriesApi,
    PrimitivePaneViewZOrder,
} from 'lightweight-charts';
import { CanvasRenderingTarget2D } from 'fancy-canvas';

export interface ManualLineData {
    points: { time: number; price: number }[];
    type: 'trend-line' | 'horizontal-line' | 'vertical-line' | 'crosshair';
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    selected?: boolean;
}

class ManualLinePaneRenderer implements IPrimitivePaneRenderer {
    _data: ManualLineData | null = null;
    _source: ManualLinePrimitive;

    constructor(data: ManualLineData | null, source: ManualLinePrimitive) {
        this._data = data;
        this._source = source;
    }

    draw(target: CanvasRenderingTarget2D) {
        if (!this._data || this._data.points.length < 1) return;

        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            const { horizontalPixelRatio, verticalPixelRatio, bitmapSize } = scope;
            const { points, color, lineWidth, lineStyle, type, selected } = this._data!;

            const chart = this._source._chart;
            const series = this._source._series;
            if (!chart || !series) return;

            const timeScale = chart.timeScale();

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, (selected ? lineWidth + 1.5 : lineWidth) * verticalPixelRatio);

            if (lineStyle === 'dashed') {
                ctx.setLineDash([5 * horizontalPixelRatio, 5 * horizontalPixelRatio]);
            } else if (lineStyle === 'dotted') {
                ctx.setLineDash([1 * horizontalPixelRatio, 2 * horizontalPixelRatio]);
            } else {
                ctx.setLineDash([]);
            }

            if (selected) {
                ctx.shadowBlur = 10 * horizontalPixelRatio;
                ctx.shadowColor = color;
            }

            if (type === 'horizontal-line') {
                const y = series.priceToCoordinate(points[0].price);
                if (y !== null) {
                    const phyY = y * verticalPixelRatio;
                    ctx.moveTo(0, phyY);
                    ctx.lineTo(bitmapSize.width, phyY);
                    ctx.stroke();
                }
            } else if (type === 'trend-line' && points.length >= 2) {
                const x1 = timeScale.timeToCoordinate(points[0].time as Time);
                const y1 = series.priceToCoordinate(points[0].price);
                const x2 = timeScale.timeToCoordinate(points[1].time as Time);
                const y2 = series.priceToCoordinate(points[1].price);

                if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                    ctx.moveTo(x1 * horizontalPixelRatio, y1 * verticalPixelRatio);
                    ctx.lineTo(x2 * horizontalPixelRatio, y2 * verticalPixelRatio);
                    ctx.stroke();
                }
            } else if (type === 'vertical-line') {
                const x = timeScale.timeToCoordinate(points[0].time as Time);
                if (x !== null) {
                    const phyX = x * horizontalPixelRatio;
                    ctx.moveTo(phyX, 0);
                    ctx.lineTo(phyX, bitmapSize.height);
                    ctx.stroke();
                }
            } else if (type === 'crosshair') {
                const x = timeScale.timeToCoordinate(points[0].time as Time);
                const y = series.priceToCoordinate(points[0].price);
                if (x !== null && y !== null) {
                    const phyX = x * horizontalPixelRatio;
                    const phyY = y * verticalPixelRatio;

                    // Horizontal part
                    ctx.moveTo(0, phyY);
                    ctx.lineTo(bitmapSize.width, phyY);

                    // Vertical part
                    ctx.moveTo(phyX, 0);
                    ctx.lineTo(phyX, bitmapSize.height);

                    ctx.stroke();
                }
            }
            ctx.restore();

            // Draw handles
            ctx.save();
            points.forEach((p, i) => {
                const x = timeScale.timeToCoordinate(p.time as Time);
                const y = series.priceToCoordinate(p.price);
                if (x !== null && y !== null) {
                    ctx.beginPath();
                    ctx.fillStyle = selected ? color : '#FFFFFF';
                    ctx.arc(x * horizontalPixelRatio, y * verticalPixelRatio, 3 * horizontalPixelRatio, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1 * horizontalPixelRatio;
                    ctx.stroke();
                }
            });
            ctx.restore();
            // Draw Delete Button (X) if selected
            if (selected && points.length > 0) {
                ctx.save();
                let midX, midY;

                if (type === 'horizontal-line') {
                    // For horizontal, put it near the right edge (or fixed offset from start)
                    // Let's put it at 100px from start or right side
                    const y = series.priceToCoordinate(points[0].price);
                    if (y !== null) {
                        midX = (timeScale.width() - 50) * horizontalPixelRatio; // 50px from right
                        midY = y * verticalPixelRatio;
                    }
                } else if (type === 'vertical-line') {
                    const x = timeScale.timeToCoordinate(points[0].time as Time);
                    if (x !== null) {
                        midX = x * horizontalPixelRatio;
                        midY = 50 * verticalPixelRatio; // 50px from top
                    }
                } else if (type === 'crosshair') {
                    const x = timeScale.timeToCoordinate(points[0].time as Time);
                    const y = series.priceToCoordinate(points[0].price);
                    if (x !== null && y !== null) {
                        midX = (x + 20 / horizontalPixelRatio) * horizontalPixelRatio; // Offset from center
                        midY = (y - 20 / verticalPixelRatio) * verticalPixelRatio;
                    }
                } else if (points.length >= 2) {
                    const x1 = timeScale.timeToCoordinate(points[0].time as Time);
                    const y1 = series.priceToCoordinate(points[0].price);
                    const x2 = timeScale.timeToCoordinate(points[1].time as Time);
                    const y2 = series.priceToCoordinate(points[1].price);

                    if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                        midX = ((x1 + x2) / 2) * horizontalPixelRatio;
                        midY = ((y1 + y2) / 2) * verticalPixelRatio;
                    }
                }

                if (midX !== undefined && midY !== undefined) {
                    // Draw Circle Background
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffff';
                    ctx.arc(midX, midY, 10 * horizontalPixelRatio, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 1 * horizontalPixelRatio;
                    ctx.strokeStyle = color;
                    ctx.stroke();

                    // Draw 'X'
                    const r = 3 * horizontalPixelRatio;
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2 * horizontalPixelRatio;

                    ctx.moveTo(midX - r, midY - r);
                    ctx.lineTo(midX + r, midY + r);
                    ctx.moveTo(midX + r, midY - r);
                    ctx.lineTo(midX - r, midY + r);
                    ctx.stroke();
                }
                ctx.restore();
            }
        });
    }
}

export class ManualLinePrimitive implements ISeriesPrimitive {
    _data: ManualLineData | null = null;
    _paneViews: ManualLinePaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;
    _requestUpdate: (() => void) | null = null;

    constructor() {
        this._paneViews = [new ManualLinePaneView(this)];
    }

    update(data: ManualLineData) {
        this._data = data;
        this._paneViews[0].update(data);
        this._requestUpdate?.();
    }

    attached({ chart, series, requestUpdate }: any) {
        this._series = series;
        this._chart = chart;
        this._requestUpdate = requestUpdate;
    }

    detached() {
        this._series = null;
        this._chart = null;
        this._requestUpdate = null;
    }

    paneViews() {
        return this._paneViews;
    }
}

class ManualLinePaneView implements IPrimitivePaneView {
    _source: ManualLinePrimitive;
    _data: ManualLineData | null = null;

    constructor(source: ManualLinePrimitive) {
        this._source = source;
    }

    update(data: ManualLineData | null) {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new ManualLinePaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}

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
            x = timeScale.width() - 50;
            y = py;
        }
    } else if (drawing.type === 'vertical-line') {
        const px = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        if (px !== null) {
            x = px;
            y = 50; // Match renderer logic
        }
    } else if (drawing.type === 'crosshair') {
        const px = timeScale.timeToCoordinate(drawing.points[0].time as Time);
        const py = series.priceToCoordinate(drawing.points[0].price);
        if (px !== null && py !== null) {
            x = px + 20;
            y = py - 20;
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
