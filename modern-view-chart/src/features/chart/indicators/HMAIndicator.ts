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
        const period = this.config.params.period || 14;

        // Minimum bar check
        if (candles.length < period) {
            if (this.series) {
                this.series.setData([]);
            }
            return;
        }

        if (!this.series) {
            const isMainPane = this.config.pane === 'main' || !this.config.pane;
            this.series = this.chart.addSeries(LineSeries, {
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                priceLineVisible: false,
                lastValueVisible: !isMainPane,
                visible: this.config.visible,
            });
        } else {
            const isMainPane = this.config.pane === 'main' || !this.config.pane;
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
                priceLineVisible: false,
                lastValueVisible: !isMainPane,
            });
        }

        const closePrices = candles.map(c => c.close);
        const hmaValues = calculateHullMA(closePrices, period);

        const data = candles
            .map((c, i) => {
                const v = hmaValues[i];
                if (v === null || v === undefined || !Number.isFinite(v)) return null;
                return {
                    time: c.time as any,
                    value: v,
                };
            })
            .filter((item): item is { time: any; value: number } => item !== null);

        if (this.series) {
            this.series.setData(data);
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
