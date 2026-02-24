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

interface SARData extends CustomData<Time> {
    value: number;
    color?: string;
}

class SARRenderer implements ICustomSeriesPaneRenderer {
    private _data: PaneRendererCustomData<Time, SARData> | null = null;
    private _options: CustomSeriesOptions | null = null;

    update(data: PaneRendererCustomData<Time, SARData> | null, options: CustomSeriesOptions) {
        this._data = data;
        this._options = options;
    }

    draw(target: any, priceConverter: any): void {
        if (!this._data || !this._data.bars || this._data.bars.length === 0 || !this._options) return;

        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const { horizontalPixelRatio, verticalPixelRatio } = scope;
            const data = this._data!;

            const dotSize = (this._options as any).dotSize || 2;
            const baseColor = this._options?.color || '#2196F3';
            const radius = (dotSize * verticalPixelRatio) / 2;

            // Group by color for performance if data has individual colors
            const barsByColor = new Map<string, any[]>();
            for (const bar of data.bars) {
                if (!isNaN(bar.x)) {
                    const color = (bar.originalData as SARData).color || baseColor;
                    if (!barsByColor.has(color)) {
                        barsByColor.set(color, []);
                    }
                    barsByColor.get(color)?.push(bar);
                }
            }

            for (const [color, bars] of barsByColor.entries()) {
                ctx.fillStyle = color;
                for (const bar of bars) {
                    const barData = bar.originalData as SARData;
                    if (barData.value === undefined || isNaN(barData.value)) continue;

                    const x = Math.round(bar.x * horizontalPixelRatio);
                    const y = priceConverter(barData.value);

                    if (y === null) continue;
                    const canvasY = Math.round(y * verticalPixelRatio);

                    ctx.beginPath();
                    ctx.arc(x, canvasY, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
    }
}

export class SARSeries implements ICustomSeriesPaneView<Time, SARData, CustomSeriesOptions> {
    private _renderer: SARRenderer = new SARRenderer();

    renderer(): ICustomSeriesPaneRenderer {
        return this._renderer;
    }

    update(data: PaneRendererCustomData<Time, SARData>, seriesOptions: CustomSeriesOptions): void {
        this._renderer.update(data, seriesOptions);
    }

    priceValueBuilder(data: SARData): CustomSeriesPricePlotValues {
        return [data.value];
    }

    isWhitespace(data: SARData | CustomSeriesWhitespaceData<Time>): data is CustomSeriesWhitespaceData<Time> {
        return (data as any).value === undefined || (data as any).value === null || isNaN((data as any).value);
    }

    defaultOptions(): CustomSeriesOptions {
        return {
            ...customSeriesDefaultOptions,
            color: '#2196F3',
            // Custom option for PSAR
            dotSize: 2,
        } as any;
    }
}
