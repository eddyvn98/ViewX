
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
    lineColor?: string;
    labelColor?: string;
    backgroundOpacity?: number;
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

            const globalLineColor = this._data?.lineColor;
            const globalLabelColor = this._data?.labelColor;
            const bgOpacity = this._data?.backgroundOpacity ?? 0.15;

            levels.forEach((level, index) => {
                // @ts-ignore
                const y = series.priceToCoordinate(level.price);
                if (y === null) return;

                const phyY = y * verticalPixelRatio;

                // 1. Draw Level Line
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = globalLineColor || level.color;
                ctx.lineWidth = Math.max(1, ((this._source._data as any)?.selected ? 2 : 1) * verticalPixelRatio);

                // Solid for 0 and 1, dashed for others
                if (level.ratio !== 0 && level.ratio !== 1) {
                    ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
                }

                ctx.moveTo(phyXStart, phyY);
                ctx.lineTo(canvasWidth, phyY);
                ctx.stroke();

                // 2. Draw Label
                ctx.fillStyle = globalLabelColor || level.color;
                const fontSize = Math.max(10, 10 * verticalPixelRatio);
                ctx.font = `${fontSize}px Inter, sans-serif, Arial`;
                ctx.textAlign = 'right';
                // Position above the line
                ctx.textBaseline = 'bottom';

                let labelParts = [];
                if (this._data!.showPercent) labelParts.push(level.label);
                if (this._data!.showPrice) labelParts.push(level.price.toFixed(2));

                const text = labelParts.join(' ');
                if (text) {
                    ctx.fillText(text, canvasWidth - 10 * horizontalPixelRatio, phyY - 2 * verticalPixelRatio);
                }

                // 3. Draw Background Fill (Golden Zone: 0.382 - 0.618)
                if (index > 0) {
                    const prevLevel = levels[index - 1];
                    const isGoldenZone = (level.ratio >= 0.382 && level.ratio <= 0.618) &&
                        (prevLevel.ratio >= 0.382 && prevLevel.ratio <= 0.618);

                    if (isGoldenZone) {
                        // @ts-ignore
                        const yPrev = series.priceToCoordinate(prevLevel.price);
                        if (yPrev !== null) {
                            const phyYPrev = yPrev * verticalPixelRatio;
                            ctx.globalAlpha = bgOpacity;
                            ctx.fillStyle = globalLineColor || level.color;
                            ctx.fillRect(phyXStart, Math.min(phyY, phyYPrev), canvasWidth - phyXStart, Math.abs(phyY - phyYPrev));
                            ctx.globalAlpha = 1.0;
                        }
                    }
                }

                ctx.restore();
            });

            // Draw handles and delete button if selected
            const selected = (this._source._data as any)?.selected;
            if (selected) {
                const p1Price = levels.find(l => l.ratio === 0)?.price ?? levels[0].price;
                const p2Price = levels.find(l => l.ratio === 1)?.price ?? levels[levels.length - 1].price;

                const y1 = series.priceToCoordinate(p1Price);
                const y2 = series.priceToCoordinate(p2Price);

                if (xStart !== null && y1 !== null && xEnd !== null && y2 !== null) {
                    const midX = ((xStart + xEnd) / 2) * horizontalPixelRatio;
                    const midY = ((y1 + y2) / 2) * verticalPixelRatio;

                    // Delete button
                    ctx.save();
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffff';
                    ctx.arc(midX, midY, 10 * horizontalPixelRatio, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 1 * horizontalPixelRatio;
                    ctx.strokeStyle = globalLineColor || '#2962FF';
                    ctx.stroke();

                    const r = 3 * horizontalPixelRatio;
                    ctx.beginPath();
                    ctx.strokeStyle = globalLineColor || '#2962FF';
                    ctx.lineWidth = 2 * horizontalPixelRatio;
                    ctx.moveTo(midX - r, midY - r);
                    ctx.lineTo(midX + r, midY + r);
                    ctx.moveTo(midX + r, midY - r);
                    ctx.lineTo(midX - r, midY + r);
                    ctx.stroke();
                    ctx.restore();

                    // Handles
                    [{ x: xStart, y: y1 }, { x: xEnd, y: y2 }].forEach(p => {
                        ctx.save();
                        ctx.beginPath();
                        ctx.fillStyle = globalLineColor || '#2962FF';
                        ctx.arc(p.x * horizontalPixelRatio, p.y * verticalPixelRatio, 3 * horizontalPixelRatio, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1 * horizontalPixelRatio;
                        ctx.stroke();
                        ctx.restore();
                    });
                }
            }
        });
    }
}

export class FibonacciPrimitive implements ISeriesPrimitive {
    _data: FibonacciData | null = null;
    _paneViews: FibonacciPaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;
    _requestUpdate: (() => void) | null = null;

    constructor(data: FibonacciData | null) {
        this._data = data;
        this._paneViews = [new FibonacciPaneView(this)];
    }

    setData(data: FibonacciData | null) {
        this._data = data;
        this._paneViews.forEach(v => v.update(data));
        this._requestUpdate?.();
    }

    update(data: any) {
        if (!data.points || data.points.length < 2) {
            this.setData(null);
            return;
        }

        const fibData: FibonacciData = {
            levels: data.levels || [],
            startTime: data.points[0].time as Time,
            endTime: data.points[1].time as Time,
            showPercent: false, // Default to false as requested
            showPrice: true
        };

        this.setData(fibData);
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
