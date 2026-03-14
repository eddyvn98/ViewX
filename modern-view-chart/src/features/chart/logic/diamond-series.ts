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
    theme?: 'light' | 'dark';
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
            const { horizontalPixelRatio, verticalPixelRatio, bitmapSize } = scope;
            const data = this._data!;
            const visibleRange = data.visibleRange;

            if (!visibleRange) return;

            // Set font for labels once (Smaller for price values)
            ctx.font = `${Math.round(8 * verticalPixelRatio)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw Breakout Rays First (as background)
            this._drawBreakoutRays(ctx, data, priceConverter, horizontalPixelRatio, verticalPixelRatio);

            const effectiveBarSpacing = (data.conflationFactor || 1) * data.barSpacing;
            const barWidthMedia = effectiveBarSpacing * 0.8;
            const barWidth = Math.max(1, Math.round(barWidthMedia * horizontalPixelRatio));
            const halfWidth = barWidth / 2;
            const from = Math.max(0, Math.floor(visibleRange.from) - 2);
            const to = Math.min(data.bars.length, Math.ceil(visibleRange.to) + 2);
            const visibleBars = data.bars.slice(from, to);

            // Group bars by color for efficient rendering
            const barsByColor = new Map<string, any[]>();
            for (const bar of visibleBars) {
                if (isNaN(bar.x)) continue;
                const x = Math.round(bar.x * horizontalPixelRatio);
                if (x < -barWidth || x > bitmapSize.width + barWidth) continue;
                const color = (bar.originalData as DiamondData).candleColor || '#22c55e';
                if (!barsByColor.has(color)) {
                    barsByColor.set(color, []);
                }
                barsByColor.get(color)?.push(bar);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, bitmapSize.width, bitmapSize.height);
            ctx.clip();

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

                    const barTheme = barData.theme || 'dark';
                    const isLightMode = barTheme === 'light';

                    // 3D Horizontal Split Gradient for fast 3D folding effect
                    const gradient = ctx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0);

                    if (isLightMode) {
                        // Light Mode: More solid, vivid colors with higher contrast
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(0.5, color);
                        // Right side slightly darker but NOT transparent
                        gradient.addColorStop(0.501, color);
                        gradient.addColorStop(1, color);

                        ctx.fillStyle = gradient;
                        ctx.save();
                        ctx.globalAlpha = 1.0; // Full opacity in light mode to prevent "nhợt nhạt"
                    } else {
                        // Dark Mode: Keep the 3D folding effect with transparency
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(0.5, color);
                        gradient.addColorStop(0.501, color + '66'); // ~40% opacity 
                        gradient.addColorStop(1, color + '66');

                        ctx.fillStyle = gradient;
                        ctx.save();
                        ctx.globalAlpha = 0.85;
                    }

                    ctx.beginPath();
                    // 4-Point Diamond (Close-centric)
                    ctx.moveTo(x, high); // Top
                    ctx.lineTo(x + halfWidth, close); // Right
                    ctx.lineTo(x, low); // Bottom
                    ctx.lineTo(x - halfWidth, close); // Left
                    ctx.lineTo(x, high); // Back to top
                    ctx.fill();
                    ctx.restore();

                    // Neon Glowing Line at Close price
                    ctx.save();

                    if (isLightMode) {
                        // Light Mode: Sharp, solid line with minimal glow to avoid washout
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 4;
                        ctx.strokeStyle = '#FFFFFF'; // White center always looks good

                        // Use a solid color or a very subtle gradient
                        ctx.strokeStyle = color; // Use body color for the line itself
                        ctx.shadowBlur = 2;

                        // Solid core for visibility
                        const lineGradient = ctx.createLinearGradient(x - halfWidth, close, x + halfWidth, close);
                        lineGradient.addColorStop(0, color);
                        lineGradient.addColorStop(0.5, '#FFFFFF');
                        lineGradient.addColorStop(1, color);
                        ctx.strokeStyle = lineGradient;
                        ctx.lineWidth = Math.max(2.5, Math.round(verticalPixelRatio * 2));
                    } else {
                        // Dark Mode: Strong neon glow
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 8;
                        const lineGradient = ctx.createLinearGradient(x - halfWidth, close, x + halfWidth, close);
                        lineGradient.addColorStop(0, color);
                        lineGradient.addColorStop(0.5, '#FFFFFF');
                        lineGradient.addColorStop(1, color);
                        ctx.strokeStyle = lineGradient;
                        ctx.lineWidth = Math.max(2, Math.round(verticalPixelRatio * 1.5));
                    }

                    ctx.globalAlpha = 1.0;
                    const crossHalf = Math.max(4, Math.floor(halfWidth * 1.0));

                    ctx.beginPath();
                    ctx.moveTo(x - crossHalf, close);
                    ctx.lineTo(x + crossHalf, close);
                    ctx.stroke();
                    ctx.restore();

                    // Draw Marker Text (HH, HL, LL, LH)
                    if (barData.markerText) {
                        const markerColor = barData.markerColor || color;
                        const isHigh = barData.markerPosition === 'aboveBar';
                        const padding = 12 * verticalPixelRatio;
                        const textY = isHigh ? high - padding : low + padding;
                        const normalizedText = String(barData.markerText).trim();
                        const normalizedColor = String(markerColor).toLowerCase();
                        const isArrowMarker = ['↑', '↓', '▲', '▼'].includes(normalizedText);
                        const isYellowMarker = normalizedColor.includes('f59e0b') || normalizedColor.includes('fbbf24') || normalizedColor.includes('ffcc00');
                        const shouldBlink = isArrowMarker && isYellowMarker;

                        ctx.save();
                        if (barData.isTentative) ctx.globalAlpha = 0.5;
                        if (shouldBlink) {
                            const pulse = 0.35 + (Math.sin(Date.now() / 220) + 1) * 0.325;
                            ctx.globalAlpha = pulse;
                        }

                        ctx.fillStyle = markerColor;
                        ctx.fillText(barData.markerText, x, textY);
                        ctx.restore();
                    }
                }
            }

            ctx.restore();
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
