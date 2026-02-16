
import {
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Time,
    IChartApi,
    ISeriesApi,
    PrimitivePaneViewZOrder,
} from 'lightweight-charts';

export interface FibonacciLevel {
    ratio: number;
    price: number;
    color: string;
    label: string;
}

export interface FibonacciData {
    levels: FibonacciLevel[];
    startTime: Time;
    endTime: Time;
    showPercent: boolean;
    showPrice: boolean;
}

class FibonacciPaneRenderer implements IPrimitivePaneRenderer {
    _data: FibonacciData | null = null;
    _source: FibonacciPrimitive;

    constructor(data: FibonacciData | null, source: FibonacciPrimitive) {
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

            const xStart = timeScale.timeToCoordinate(this._data!.startTime);
            const xEnd = timeScale.timeToCoordinate(this._data!.endTime);

            const canvasWidth = scope.bitmapSize.width;

            // If both points are to the left of the visible range, xStart and xEnd are null.
            // We should still draw if the prices are within or relevant to the current view.

            let phyXStart = xStart !== null ? xStart * horizontalPixelRatio : 0;
            // If xStart is null, it means it's likely off-screen to the left. 
            // We'll just start from the left edge of the visible range.

            const phyXEnd = xEnd !== null ? xEnd * horizontalPixelRatio : canvasWidth;

            levels.forEach((level, index) => {
                // @ts-ignore
                const y = series.priceToCoordinate(level.price);
                if (y === null) return;

                const phyY = y * verticalPixelRatio;

                // 1. Draw Level Line
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = level.color;
                ctx.lineWidth = Math.max(1, 1 * verticalPixelRatio);

                // Solid for 0 and 1, dashed for others
                if (level.ratio !== 0 && level.ratio !== 1) {
                    ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
                }

                ctx.moveTo(phyXStart, phyY);
                ctx.lineTo(canvasWidth, phyY);
                ctx.stroke();

                // 2. Draw Label
                ctx.fillStyle = level.color;
                const fontSize = Math.max(10, 10 * verticalPixelRatio);
                ctx.font = `${fontSize}px Inter, sans-serif, Arial`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle'; // Center label on line

                let labelParts = [];
                if (this._data!.showPercent) labelParts.push(level.label);
                if (this._data!.showPrice) labelParts.push(level.price.toFixed(2));

                const text = labelParts.join(' ');
                if (text) {
                    ctx.fillText(text, canvasWidth - 10 * horizontalPixelRatio, phyY);
                }

                // 3. Draw Background Fill (Golden Zone: 0.382 - 0.618)
                if (index > 0) {
                    const prevLevel = levels[index - 1];
                    // Fill between any two levels that are within the range 0.236 to 0.786 for visibility, 
                    // or strictly 0.382 - 0.618 if you want exactly that.
                    const isGoldenZone = (level.ratio >= 0.382 && level.ratio <= 0.618) &&
                        (prevLevel.ratio >= 0.382 && prevLevel.ratio <= 0.618);

                    if (isGoldenZone) {
                        // @ts-ignore
                        const yPrev = series.priceToCoordinate(prevLevel.price);
                        if (yPrev !== null) {
                            const phyYPrev = yPrev * verticalPixelRatio;
                            // Safe rgba conversion for hex or named colors
                            ctx.globalAlpha = 0.15;
                            ctx.fillStyle = level.color;
                            ctx.fillRect(phyXStart, Math.min(phyY, phyYPrev), canvasWidth - phyXStart, Math.abs(phyY - phyYPrev));
                            ctx.globalAlpha = 1.0;
                        }
                    }
                }

                ctx.restore();
            });
        });
    }
}

export class FibonacciPrimitive implements ISeriesPrimitive {
    _data: FibonacciData | null = null;
    _paneViews: FibonacciPaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;

    constructor(data: FibonacciData | null) {
        this._data = data;
        this._paneViews = [new FibonacciPaneView(this)];
    }

    setData(data: FibonacciData | null) {
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

class FibonacciPaneView implements IPrimitivePaneView {
    _source: FibonacciPrimitive;
    _data: FibonacciData | null = null;

    constructor(source: FibonacciPrimitive) {
        this._source = source;
    }

    update(data: FibonacciData | null) {
        this._data = data;
    }

    renderer() {
        return new FibonacciPaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}
