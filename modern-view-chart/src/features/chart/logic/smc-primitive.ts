import {
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Time,
    IChartApi,
    ISeriesApi,
    PrimitivePaneViewZOrder,
} from 'lightweight-charts';

export interface SMCZone {
    id: string;
    startTime: Time;
    endTime: Time | null; // null if it extends to the right (future)
    top: number;
    bottom: number;
    color: string;
    borderColor?: string;
    label?: string;
    isMitigated?: boolean;
}

export interface SMCData {
    zones: SMCZone[];
}

class SMCPaneRenderer implements IPrimitivePaneRenderer {
    _data: SMCData | null = null;
    _source: SMCPrimitive;

    constructor(data: SMCData | null, source: SMCPrimitive) {
        this._data = data;
        this._source = source;
    }

    draw(target: any) {
        if (!this._data || this._data.zones.length === 0) return;

        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const horizontalPixelRatio = scope.horizontalPixelRatio;
            const verticalPixelRatio = scope.verticalPixelRatio;

            const chart = this._source._chart;
            const series = this._source._series;
            if (!chart || !series) return;

            const timeScale = chart.timeScale();
            const canvasWidth = scope.bitmapSize.width;

            this._data!.zones.forEach(zone => {
                // @ts-ignore
                const yTop = series.priceToCoordinate(zone.top);
                // @ts-ignore
                const yBottom = series.priceToCoordinate(zone.bottom);

                if (yTop === null || yBottom === null) return;

                const xStart = timeScale.timeToCoordinate(zone.startTime);
                // If zone is mitigated or has a fixed end, use it. Otherwise, extend to canvas width.
                const xEnd = zone.endTime ? timeScale.timeToCoordinate(zone.endTime) : null;

                const phyXStart = xStart !== null ? xStart * horizontalPixelRatio : 0;
                const phyXEnd = xEnd !== null ? xEnd * horizontalPixelRatio : canvasWidth;

                const phyYTop = yTop * verticalPixelRatio;
                const phyYBottom = yBottom * verticalPixelRatio;

                const width = phyXEnd - phyXStart;
                const height = phyYBottom - phyYTop;

                if (width <= 0) return;

                ctx.save();

                // Draw Fill
                ctx.fillStyle = zone.color;
                ctx.fillRect(phyXStart, phyYTop, width, height);

                // Draw Border if specified
                if (zone.borderColor) {
                    ctx.strokeStyle = zone.borderColor;
                    ctx.lineWidth = Math.max(1, 0.5 * verticalPixelRatio);
                    ctx.strokeRect(phyXStart, phyYTop, width, height);
                }

                // Draw Label
                if (zone.label) {
                    ctx.fillStyle = zone.borderColor || 'rgba(255, 255, 255, 0.5)';
                    const fontSize = Math.max(8, 8 * verticalPixelRatio);
                    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(zone.label, phyXStart + 4 * horizontalPixelRatio, phyYTop + 2 * verticalPixelRatio);
                }

                ctx.restore();
            });
        });
    }
}

export class SMCPrimitive implements ISeriesPrimitive {
    _data: SMCData | null = null;
    _paneViews: SMCPaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;
    _requestUpdate: (() => void) | null = null;

    constructor(data: SMCData | null = null) {
        this._data = data;
        this._paneViews = [new SMCPaneView(this)];
    }

    setData(data: SMCData | null) {
        this._data = data;
        this._paneViews.forEach(v => v.update(data));
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

class SMCPaneView implements IPrimitivePaneView {
    _source: SMCPrimitive;
    _data: SMCData | null = null;

    constructor(source: SMCPrimitive) {
        this._source = source;
    }

    update(data: SMCData | null) {
        this._data = data;
    }

    renderer() {
        return new SMCPaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}
