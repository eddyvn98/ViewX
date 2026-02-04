import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';

export class RSIIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        if (!this.series) {
            // Use DEDICATED 'rsi' price scale (separate from main chart)
            this.series = this.chart.addSeries(LineSeries, {
                color: this.config.color,
                lineWidth: 2,
                priceScaleId: 'rsi', // Dedicated RSI scale
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
            });

            const priceScale = this.chart.priceScale('rsi');
            if (priceScale && typeof priceScale.applyOptions === 'function') {
                priceScale.applyOptions({
                    autoScale: true,
                    borderVisible: true,
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.1,
                    },
                });
            } else {
                console.warn('[RSI] Could not find/create price scale "rsi"');
            }

            // Add standard lines
            if (this.series) {
                this.series.createPriceLine({
                    price: this.config.params.upperLimit || 70,
                    color: '#ef4444',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: '70',
                });

                this.series.createPriceLine({
                    price: this.config.params.lowerLimit || 30,
                    color: '#22c55e',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: '30',
                });
            }
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
            });
        }

        if (!this.series) return;

        const closePrices = candles.map(c => c.close);
        const rsiValues = calculateRSI(closePrices, this.config.params.period);

        const seriesData = candles
            .map((c, i) => {
                const v = rsiValues[i];
                if (!Number.isFinite(v)) return null;
                return {
                    time: c.time as any,
                    value: v,
                };
            })
            .filter((item): item is { time: any; value: number } => item !== null);

        if (seriesData.length > 0) {
            this.series.setData(seriesData);
        } else {
            console.warn('[RSI] No valid data points to display');
        }
    }

    destroy() {
        if (this.series && this.chart) {
            try {
                this.chart.removeSeries(this.series);
            } catch (err) {
                console.warn('[RSI] Failed to remove series:', err);
            }
            this.series = null;
        }
    }
}
