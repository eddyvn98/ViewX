
import {
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Time,
    IChartApi,
    ISeriesApi,
    PrimitivePaneViewZOrder,
} from 'lightweight-charts';

export interface TrendLinePoint {
    time: Time;
    price: number;
}

export interface TrendLineData {
    p1: TrendLinePoint;
    p2: TrendLinePoint;
    color: string;
    width: number;
    style: number; // 1=Solid, 2=Dotted, 3=Dashed, 4=LargeDashed
    extendRight?: boolean;
}

class TrendLinePaneRenderer implements IPrimitivePaneRenderer {
    _data: TrendLineData[] = [];
    _source: TrendLinePrimitive;

    constructor(data: TrendLineData[], source: TrendLinePrimitive) {
        this._data = data;
        this._source = source;
    }

    draw(target: any) {
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const horizontalPixelRatio = scope.horizontalPixelRatio;
            const verticalPixelRatio = scope.verticalPixelRatio;

            // Access Chart API from Source to get scales
            const chart = this._source._chart;
            const series = this._source._series;

            if (!chart || !series) return;

            const timeScale = chart.timeScale();

            this._data.forEach(line => {
                const x1 = timeScale.timeToCoordinate(line.p1.time);
                const x2 = timeScale.timeToCoordinate(line.p2.time);

                // @ts-ignore - Accessing private API or known method
                const y1 = series.priceToCoordinate(line.p1.price);
                // @ts-ignore
                const y2 = series.priceToCoordinate(line.p2.price);

                if (x1 === null || x2 === null || y1 === null || y2 === null) return;

                // CONVERT TO PHYSICAL COORDINATES FIRST
                // This ensures all math (slope, extension) happens in the same space (Bitmap)
                const phyX1 = x1 * horizontalPixelRatio;
                const phyY1 = y1 * verticalPixelRatio;
                const phyX2 = x2 * horizontalPixelRatio;
                const phyY2 = y2 * verticalPixelRatio;

                ctx.save();
                ctx.beginPath();
                ctx.lineWidth = line.width * verticalPixelRatio; // Scale width
                ctx.strokeStyle = line.color;

                // Line Style
                if (line.style === 2) ctx.setLineDash([2 * horizontalPixelRatio, 2 * horizontalPixelRatio]); // Dotted
                if (line.style === 3) ctx.setLineDash([6 * horizontalPixelRatio, 6 * horizontalPixelRatio]); // Dashed
                if (line.style === 4) ctx.setLineDash([12 * horizontalPixelRatio, 12 * horizontalPixelRatio]); // Large Dashed

                ctx.moveTo(phyX1, phyY1);

                if (line.extendRight) {
                    // Calculate boundaries in PHYSICAL space
                    const width = scope.bitmapSize.width; // Physical width

                    // Linear extension: y = mx + c
                    // m = (y2 - y1) / (x2 - x1)
                    if (phyX2 !== phyX1) {
                        const m = (phyY2 - phyY1) / (phyX2 - phyX1);
                        const xFinal = width; // Draw to end of canvas (Physical)
                        const yFinal = phyY2 + m * (xFinal - phyX2);

                        ctx.lineTo(xFinal, yFinal);
                    } else {
                        // Vertical line extension?
                        ctx.lineTo(phyX2, scope.bitmapSize.height);
                    }
                } else {
                    ctx.lineTo(phyX2, phyY2);
                }

                ctx.stroke();
                ctx.restore();
            });
        });
    }
}

export class TrendLinePrimitive implements ISeriesPrimitive {
    _data: TrendLineData[] = [];
    _paneViews: TrendLinePaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;

    constructor(data: TrendLineData[]) {
        this._data = data;
        this._paneViews = [new TrendLinePaneView(this)];
    }

    setData(data: TrendLineData[]) {
        this._data = data;
        this._paneViews.forEach(v => v.update(data));
    }

    attached({ chart, series, requestUpdate }: any) {
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

class TrendLinePaneView implements IPrimitivePaneView {
    _source: TrendLinePrimitive;
    _data: TrendLineData[] = [];

    constructor(source: TrendLinePrimitive) {
        this._source = source;
    }

    update(data: TrendLineData[]) {
        this._data = data;
    }

    renderer() {
        return new TrendLinePaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'normal';
    }
}
