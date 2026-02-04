import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateHullMA } from '../utils/indicator-math';

export class HMAIndicator {
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
                // title: `Hull ${this.config.params.period}`, // Moved to Legend
                priceLineVisible: false,
                lastValueVisible: false,
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
            });
        }

        const closePrices = candles.map(c => c.close);
        const hmaValues = calculateHullMA(closePrices, this.config.params.period);

        const data = candles.map((c, i) => ({
            time: c.time as any,
            value: hmaValues[i]
        })).filter(d => !isNaN(d.value));

        this.series.setData(data);
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
