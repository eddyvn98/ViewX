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
            this.series = this.chart.addSeries(LineSeries, {
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                // title: `RSI ${this.config.params.period}`, // Moved to Legend
                priceScaleId: 'rsi',
                visible: this.config.visible,
                lastValueVisible: false, // Ensure hidden from axis
                priceLineVisible: false,
            });

            this.chart.priceScale('rsi').applyOptions({
                autoScale: true,
                scaleMargins: {
                    top: 0.8,
                    bottom: 0.05,
                },
                borderVisible: true,
            });

            // Add standard lines
            this.series.createPriceLine({
                price: this.config.params.upperLimit || 60,
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false, // SMART: Hide from axis, already in legend
                title: '60',
            });

            this.series.createPriceLine({
                price: this.config.params.lowerLimit || 40,
                color: '#22c55e',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false, // SMART: Hide from axis
                title: '40',
            });
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
                // title: `RSI ${this.config.params.period}`, // Moved to Legend
                lastValueVisible: false,
                priceLineVisible: false,
            });
        }

        const closePrices = candles.map(c => c.close);
        const rsiValues = calculateRSI(closePrices, this.config.params.period);

        const data = candles.map((c, i) => ({
            time: c.time as any,
            value: rsiValues[i]
        })).filter(d => !isNaN(d.value));

        this.series.setData(data);
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
