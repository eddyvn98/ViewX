import {
    ICustomSeriesPaneRenderer,
    PaneRendererCustomData,
    ICustomSeriesPaneView,
    CustomData,
    CustomSeriesPricePlotValues,
    CustomSeriesOptions,
    CustomSeriesWhitespaceData,
    Time,
    customSeriesDefaultOptions,
} from 'lightweight-charts';

interface DiamondData extends CustomData<Time> {
    open: number;
    high: number;
    low: number;
    close: number;
    candleColor?: string;
    markerText?: string;
    markerColor?: string;
    markerPosition?: 'aboveBar' | 'belowBar';
    isTentative?: boolean;
    breakoutRayHH?: number; // Price of the latest HH
    breakoutRayLL?: number; // Price of the latest LL
}

class DiamondRenderer implements ICustomSeriesPaneRenderer {
    private _data: PaneRendererCustomData<Time, DiamondData> | null = null;

    update(data: PaneRendererCustomData<Time, DiamondData> | null) {
        this._data = data;
    }

    private _drawBreakoutRays(ctx: CanvasRenderingContext2D, data: PaneRendererCustomData<Time, DiamondData>, priceConverter: any, horizontalPixelRatio: number, verticalPixelRatio: number): void {
        const { bars, visibleRange } = data;
        if (!visibleRange || bars.length === 0) return;

        // Use the latest prices from the very last bar (all bars have the same latest prices)
        const lastBar = bars[bars.length - 1].originalData as DiamondData;
        const hhPrice = lastBar.breakoutRayHH;
        const llPrice = lastBar.breakoutRayLL;

        ctx.save();
        ctx.setLineDash([5 * horizontalPixelRatio, 5 * horizontalPixelRatio]);
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = Math.max(1, Math.floor(verticalPixelRatio));

        if (hhPrice !== undefined && hhPrice !== null) {
            const y = priceConverter(hhPrice);
            if (y !== null) {
                ctx.beginPath();
                ctx.strokeStyle = '#ff3366'; // HH Ray
                ctx.moveTo(0, Math.round(y * verticalPixelRatio));
                ctx.lineTo(ctx.canvas.width, Math.round(y * verticalPixelRatio));
                ctx.stroke();
            }
        }

        if (llPrice !== undefined && llPrice !== null) {
            const y = priceConverter(llPrice);
            if (y !== null) {
                ctx.beginPath();
                ctx.strokeStyle = '#00ff88'; // LL Ray
                ctx.moveTo(0, Math.round(y * verticalPixelRatio));
                ctx.lineTo(ctx.canvas.width, Math.round(y * verticalPixelRatio));
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    draw(target: any, priceConverter: any): void {
        if (!this._data || !this._data.bars || this._data.bars.length === 0) return;

        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const { horizontalPixelRatio, verticalPixelRatio } = scope;
            const data = this._data!;

            // Set font for labels once (Smaller for price values)
            ctx.font = `${Math.round(8 * verticalPixelRatio)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw Breakout Rays First (as background)
            this._drawBreakoutRays(ctx, data, priceConverter, horizontalPixelRatio, verticalPixelRatio);

            const barWidthMedia = data.barSpacing * 0.8;
            const barWidth = Math.max(1, Math.round(barWidthMedia * horizontalPixelRatio));
            const halfWidth = barWidth / 2;

            // Group bars by color for efficient rendering
            const barsByColor = new Map<string, any[]>();
            for (const bar of data.bars) {
                if (!isNaN(bar.x)) {
                    const color = (bar.originalData as DiamondData).candleColor || '#22c55e';
                    if (!barsByColor.has(color)) {
                        barsByColor.set(color, []);
                    }
                    barsByColor.get(color)?.push(bar);
                }
            }

            for (const [color, bars] of barsByColor.entries()) {
                ctx.lineWidth = 1;
                for (const bar of bars) {
                    if (isNaN(bar.x)) continue;
                    const barData = bar.originalData as DiamondData;

                    const x = Math.round(bar.x * horizontalPixelRatio);

                    const openY = priceConverter(barData.open);
                    const closeY = priceConverter(barData.close);
                    const highY = priceConverter(barData.high);
                    const lowY = priceConverter(barData.low);

                    if (openY === null || closeY === null || highY === null || lowY === null) continue;

                    const high = Math.round(highY * verticalPixelRatio);
                    const low = Math.round(lowY * verticalPixelRatio);
                    const close = Math.round(closeY * verticalPixelRatio);

                    // Gradient Fill (Vertical)
                    const gradient = ctx.createLinearGradient(0, high, 0, low);

                    let ratio = 0.5;
                    if (low !== high) {
                        ratio = (close - high) / (low - high);
                        ratio = Math.max(0, Math.min(1, ratio));
                    }

                    // Sharper Gradient: Min opacity 60% at tips for visibility on Light Mode
                    gradient.addColorStop(0, color + '99'); // 60%
                    gradient.addColorStop(ratio, color);
                    gradient.addColorStop(1, color + '99'); // 60%

                    ctx.fillStyle = gradient;
                    ctx.strokeStyle = color; // Solid stroke for sharp edges

                    ctx.beginPath();
                    // 4-Point Diamond (Close-centric)
                    // 1. Top Point (High)
                    ctx.moveTo(x, high);
                    // 2. Right Point (Close)
                    ctx.lineTo(x + halfWidth, close);
                    // 3. Bottom Point (Low)
                    ctx.lineTo(x, low);
                    // 4. Left Point (Close)
                    ctx.lineTo(x - halfWidth, close);
                    // Back to Top
                    ctx.lineTo(x, high);

                    ctx.fill();
                    ctx.stroke();

                    // Keep candles crisp: skip extra faceted overlays that stack alpha and cause haze.

                    // Draw Marker Text (HH, HL, LL, LH)
                    if (barData.markerText) {
                        const markerColor = barData.markerColor || color;
                        const isHigh = barData.markerPosition === 'aboveBar';
                        const padding = 12 * verticalPixelRatio;
                        const textY = isHigh ? high - padding : low + padding;

                        ctx.save();
                        if (barData.isTentative) ctx.globalAlpha = 0.5;

                        ctx.fillStyle = markerColor;
                        ctx.fillText(barData.markerText, x, textY);

                        // Small dot indicator
                        ctx.beginPath();
                        ctx.arc(x, isHigh ? high - (4 * verticalPixelRatio) : low + (4 * verticalPixelRatio), 2 * verticalPixelRatio, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        });
    }
}

export class DiamondSeries implements ICustomSeriesPaneView<Time, DiamondData, CustomSeriesOptions> {
    private _renderer: DiamondRenderer = new DiamondRenderer();

    renderer(): ICustomSeriesPaneRenderer {
        return this._renderer;
    }

    update(data: PaneRendererCustomData<Time, DiamondData>, seriesOptions: CustomSeriesOptions): void {
        this._renderer.update(data);
    }

    priceValueBuilder(data: DiamondData): CustomSeriesPricePlotValues {
        return [data.high, data.low, data.close];
    }

    isWhitespace(data: DiamondData | CustomSeriesWhitespaceData<Time>): data is CustomSeriesWhitespaceData<Time> {
        return (data as any).high === undefined || (data as any).high === null;
    }

    defaultOptions(): CustomSeriesOptions {
        return {
            ...customSeriesDefaultOptions,
            color: '#22c55e',
        };
    }
}
