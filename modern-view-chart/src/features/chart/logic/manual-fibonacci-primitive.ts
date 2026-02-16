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

export interface ManualFibonacciData {
    points: { time: number; price: number }[];
    type: 'fib-retracement' | 'fib-extension';
    levels: { ratio: number; price: number; color: string }[];
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    selected?: boolean;
}

class ManualFibonacciPaneRenderer implements IPrimitivePaneRenderer {
    _data: ManualFibonacciData | null = null;
    _source: ManualFibonacciPrimitive;

    constructor(data: ManualFibonacciData | null, source: ManualFibonacciPrimitive) {
        this._data = data;
        this._source = source;
    }

    draw(target: CanvasRenderingTarget2D) {
        if (!this._data || this._data.points.length < 2) return;

        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            const { horizontalPixelRatio, verticalPixelRatio, bitmapSize } = scope;
            const { points, levels, color, lineWidth, lineStyle, type, selected } = this._data!;

            const chart = this._source._chart;
            const series = this._source._series;
            if (!chart || !series) return;

            const timeScale = chart.timeScale();

            // Calculate trend lines
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5 * horizontalPixelRatio, 5 * horizontalPixelRatio]);
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, 1 * verticalPixelRatio);

            const x1 = timeScale.timeToCoordinate(points[0].time as Time);
            const y1 = series.priceToCoordinate(points[0].price);
            const x2 = timeScale.timeToCoordinate(points[1].time as Time);
            const y2 = series.priceToCoordinate(points[1].price);

            if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                ctx.moveTo(x1 * horizontalPixelRatio, y1 * verticalPixelRatio);
                ctx.lineTo(x2 * horizontalPixelRatio, y2 * verticalPixelRatio);

                if (type === 'fib-extension' && points[2]) {
                    const x3 = timeScale.timeToCoordinate(points[2].time as Time);
                    const y3 = series.priceToCoordinate(points[2].price);
                    if (x3 !== null && y3 !== null) {
                        ctx.lineTo(x3 * horizontalPixelRatio, y3 * verticalPixelRatio);
                    }
                }
            }
            ctx.stroke();

            // Draw handles at points
            points.forEach((p, i) => {
                const x = timeScale.timeToCoordinate(p.time as Time);
                const y = series.priceToCoordinate(p.price);
                if (x !== null && y !== null) {
                    ctx.beginPath();
                    ctx.fillStyle = i === points.length - 1 && points.length < (type === 'fib-extension' ? 4 : 3) ? '#FFD700' : color;
                    ctx.arc(x * horizontalPixelRatio, y * verticalPixelRatio, 3 * horizontalPixelRatio, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1 * horizontalPixelRatio;
                    ctx.stroke();
                }
            });
            ctx.restore();

            // Draw levels
            levels.forEach(level => {
                const y = series.priceToCoordinate(level.price);
                if (y === null) return;

                const phyY = y * verticalPixelRatio;

                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = level.color;
                ctx.lineWidth = Math.max(1, (selected ? lineWidth + 1.5 : lineWidth) * verticalPixelRatio);

                // Set line style
                if (lineStyle === 'dashed') {
                    ctx.setLineDash([5 * horizontalPixelRatio, 5 * horizontalPixelRatio]);
                } else if (lineStyle === 'dotted') {
                    ctx.setLineDash([1 * horizontalPixelRatio, 2 * horizontalPixelRatio]);
                } else {
                    ctx.setLineDash([]);
                }

                if (selected) {
                    ctx.shadowBlur = 10 * horizontalPixelRatio;
                    ctx.shadowColor = level.color;
                }

                ctx.moveTo(0, phyY);
                ctx.lineTo(bitmapSize.width, phyY);
                ctx.stroke();
                ctx.restore();

                // Label
                ctx.fillStyle = level.color;
                ctx.font = `bold ${Math.max(10, 10 * verticalPixelRatio)}px Inter, sans-serif`;
                ctx.textAlign = 'right';
                ctx.fillText(
                    `${(level.ratio * 100).toFixed(1)}% (${level.price.toFixed(2)})`,
                    bitmapSize.width - 5 * horizontalPixelRatio,
                    phyY - 5 * verticalPixelRatio
                );
            });
        });
    }
}

export class ManualFibonacciPrimitive implements ISeriesPrimitive {
    _data: ManualFibonacciData | null = null;
    _paneViews: ManualFibonacciPaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;

    constructor() {
        this._paneViews = [new ManualFibonacciPaneView(this)];
    }

    update(data: ManualFibonacciData) {
        this._data = data;
        this._paneViews[0].update(data);
    }

    attached({ chart, series }: any) {
        this._series = series;
        this._chart = chart;
    }

    detached() {
        this._series = null;
        this._chart = null;
    }

    paneViews() {
        return this._paneViews;
    }
}

class ManualFibonacciPaneView implements IPrimitivePaneView {
    _source: ManualFibonacciPrimitive;
    _data: ManualFibonacciData | null = null;

    constructor(source: ManualFibonacciPrimitive) {
        this._source = source;
    }

    update(data: ManualFibonacciData | null) {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new ManualFibonacciPaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}
