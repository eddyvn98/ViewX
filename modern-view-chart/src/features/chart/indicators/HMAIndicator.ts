import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateHullMA } from '../utils/indicator-math';

export class HMAIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                // title: `Hull ${this.config.params.period}`, // Moved to Legend
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false, // Disable for performance
                visible: this.config.visible,
            });
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
                // title: `Hull ${this.config.params.period}`, // Moved to Legend
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false, // Disable for performance
            });
        }

        const hmaValues = calculatedValues || calculateHullMA(candles.map(c => c.close), this.config.params.period);

        const data = candles
            .map((c, i) => {
                const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
                const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
                return {
                    time: time as any,
                    value: hmaValues[i]
                };
            })
            .filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible || candles.length < this.config.params.period) return;

        const period = this.config.params.period;
        const lastIdx = candles.length - 1;

        // Use full history for 100% accuracy matching the chart
        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close;

        const hmaValues = calculateHullMA(prices, period);
        const lastVal = hmaValues[hmaValues.length - 1];

        if (!isNaN(lastVal)) {
            const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
            const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            try {
                this.series.update({
                    time: candleTime as any,
                    value: lastVal
                });
            } catch (err) {
                // Ignore "Cannot update oldest data" errors which happen during rapid updates/race conditions
            }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            try {
                this.chart.removeSeries(this.series);
            } catch (err) {
                console.warn('[HMA] Failed to remove series:', err);
            }
            this.series = null;
        }
    }
}
