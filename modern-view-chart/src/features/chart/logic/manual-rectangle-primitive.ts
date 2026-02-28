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

export interface ManualRectangleData {
    points: { time: number; price: number }[];
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    selected?: boolean;
}

class ManualRectanglePaneRenderer implements IPrimitivePaneRenderer {
    _data: ManualRectangleData | null = null;
    _source: ManualRectanglePrimitive;

    constructor(data: ManualRectangleData | null, source: ManualRectanglePrimitive) {
        this._data = data;
        this._source = source;
    }

    draw(target: CanvasRenderingTarget2D) {
        if (!this._data || this._data.points.length < 2) return;

        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            const { horizontalPixelRatio, verticalPixelRatio } = scope;
            const { points, color, lineWidth, lineStyle, selected } = this._data!;

            const chart = this._source._chart;
            const series = this._source._series;
            if (!chart || !series) return;

            const timeScale = chart.timeScale();

            const x1 = timeScale.timeToCoordinate(points[0].time as Time);
            const y1 = series.priceToCoordinate(points[0].price);
            const x2 = timeScale.timeToCoordinate(points[1].time as Time);
            const y2 = series.priceToCoordinate(points[1].price);

            if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                const px1 = x1 * horizontalPixelRatio;
                const py1 = y1 * verticalPixelRatio;
                const px2 = x2 * horizontalPixelRatio;
                const py2 = y2 * verticalPixelRatio;

                ctx.save();

                // Fill
                ctx.fillStyle = color + '22'; // 13% opacity
                ctx.fillRect(px1, py1, px2 - px1, py2 - py1);

                // Border
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

                ctx.strokeRect(px1, py1, px2 - px1, py2 - py1);
                ctx.restore();

                // Draw handles
                ctx.save();
                points.forEach((p) => {
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

                // Draw delete button if selected
                if (selected && points.length >= 2) {
                    const midX = ((x1 + x2) / 2) * horizontalPixelRatio;
                    const midY = ((y1 + y2) / 2) * verticalPixelRatio;

                    ctx.save();
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffff';
                    ctx.arc(midX, midY, 10 * horizontalPixelRatio, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 1 * horizontalPixelRatio;
                    ctx.strokeStyle = color;
                    ctx.stroke();

                    const r = 3 * horizontalPixelRatio;
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2 * horizontalPixelRatio;
                    ctx.moveTo(midX - r, midY - r);
                    ctx.lineTo(midX + r, midY + r);
                    ctx.moveTo(midX + r, midY - r);
                    ctx.lineTo(midX - r, midY + r);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        });
    }
}

export class ManualRectanglePrimitive implements ISeriesPrimitive {
    _data: ManualRectangleData | null = null;
    _paneViews: ManualRectanglePaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;
    _requestUpdate: (() => void) | null = null;

    constructor() {
        this._paneViews = [new ManualRectanglePaneView(this)];
    }

    update(data: ManualRectangleData) {
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

class ManualRectanglePaneView implements IPrimitivePaneView {
    _source: ManualRectanglePrimitive;
    _data: ManualRectangleData | null = null;

    constructor(source: ManualRectanglePrimitive) {
        this._source = source;
    }

    update(data: ManualRectangleData | null) {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new ManualRectanglePaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}
