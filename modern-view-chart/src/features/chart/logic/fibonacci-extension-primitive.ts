
import {
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Time,
    IChartApi,
    ISeriesApi,
    PrimitivePaneViewZOrder,
} from 'lightweight-charts';

export interface FibonacciExtensionLevel {
    ratio: number;
    price: number;
    color: string;
    label: string;
}

export interface FibonacciExtensionData {
    levels: FibonacciExtensionLevel[];
    p1Time: Time;
    p2Time: Time;
    p3Time: Time;
    p1Price: number;
    p2Price: number;
    p3Price: number;
    showPercent: boolean;
    showPrice: boolean;
}

class FibonacciExtensionPaneRenderer implements IPrimitivePaneRenderer {
    _data: FibonacciExtensionData | null = null;
    _source: FibonacciExtensionPrimitive;

    constructor(data: FibonacciExtensionData | null, source: FibonacciExtensionPrimitive) {
        this._data = data;
        this._source = source;
    }

    draw(target: any) {
        if (!this._data || this._data.levels.length === 0) return;

        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const horizontalPixelRatio = scope.horizontalPixelRatio;
            const verticalPixelRatio = scope.verticalPixelRatio;

            const chart = this._source._chart;
            const series = this._source._series;
            if (!chart || !series) return;

            const timeScale = chart.timeScale();
            const levels = this._data!.levels;

            const xStart = timeScale.timeToCoordinate(this._data!.p1Time);
            const xPeak = timeScale.timeToCoordinate(this._data!.p2Time);
            const xEnd = timeScale.timeToCoordinate(this._data!.p3Time);

            const canvasWidth = scope.bitmapSize.width;
            const phyXEnd = xEnd !== null ? xEnd * horizontalPixelRatio : 0;

            levels.forEach((level) => {
                // @ts-ignore
                const y = series.priceToCoordinate(level.price);
                if (y === null) return;

                const phyY = y * verticalPixelRatio;

                // 1. Draw Level Line (from P3 to infinity)
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = level.color;
                ctx.lineWidth = Math.max(1, 1 * verticalPixelRatio);

                // Solid for major, dashed for others
                if (level.ratio !== 0 && level.ratio !== 1 && level.ratio !== 1.618) {
                    ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
                }

                ctx.moveTo(phyXEnd, phyY);
                ctx.lineTo(canvasWidth, phyY);
                ctx.stroke();

                // 2. Draw Label
                ctx.fillStyle = level.color;
                const fontSize = Math.max(10, 10 * verticalPixelRatio);
                ctx.font = `${fontSize}px Inter, sans-serif, Arial`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';

                let labelParts = [];
                if (this._data!.showPercent) labelParts.push(level.label);
                if (this._data!.showPrice) labelParts.push(level.price.toFixed(2));

                const text = labelParts.join(' ');
                if (text) {
                    ctx.fillText(text, canvasWidth - 10 * horizontalPixelRatio, phyY);
                }
                ctx.restore();
            });

            // 3. Draw Trend Lines (P1 -> P2 -> P3)
            ctx.save();
            ctx.setLineDash([2 * horizontalPixelRatio, 2 * horizontalPixelRatio]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1 * verticalPixelRatio;

            const y1 = series.priceToCoordinate(this._data!.p1Price);
            const y2 = series.priceToCoordinate(this._data!.p2Price);
            const y3 = series.priceToCoordinate(this._data!.p3Price);

            if (y1 !== null && y2 !== null && y3 !== null && xStart !== null && xPeak !== null && xEnd !== null) {
                const phyXStart = xStart * horizontalPixelRatio;
                const phyXPeak = xPeak * horizontalPixelRatio;
                const phyXEnd = xEnd * horizontalPixelRatio;
                const phyY1 = y1 * verticalPixelRatio;
                const phyY2 = y2 * verticalPixelRatio;
                const phyY3 = y3 * verticalPixelRatio;

                ctx.beginPath();
                ctx.moveTo(phyXStart, phyY1);
                ctx.lineTo(phyXPeak, phyY2);
                ctx.lineTo(phyXEnd, phyY3);
                ctx.stroke();
            }

            ctx.restore();
        });
    }
}

export class FibonacciExtensionPrimitive implements ISeriesPrimitive {
    _data: FibonacciExtensionData | null = null;
    _paneViews: FibonacciExtensionPaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;

    constructor(data: FibonacciExtensionData | null) {
        this._data = data;
        this._paneViews = [new FibonacciExtensionPaneView(this)];
    }

    setData(data: FibonacciExtensionData | null) {
        this._data = data;
        this._paneViews.forEach(v => v.update(data));
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

class FibonacciExtensionPaneView implements IPrimitivePaneView {
    _source: FibonacciExtensionPrimitive;
    _data: FibonacciExtensionData | null = null;

    constructor(source: FibonacciExtensionPrimitive) {
        this._source = source;
    }

    update(data: FibonacciExtensionData | null) {
        this._data = data;
    }

    renderer() {
        return new FibonacciExtensionPaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}
