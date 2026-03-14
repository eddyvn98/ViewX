import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateATR } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class ATRIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const styles = this.config.styles || {};
        const lineColor = styles.line || this.config.color || '#f06292';
        const lineWidth = styles.width || this.config.lineWidth || 2;

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: lineColor,
                lineWidth: lineWidth as any,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });
        } else {
            this.series.applyOptions({
                color: lineColor,
                lineWidth: lineWidth as any,
                visible: this.config.visible,
            });
        }

        const atrValues = calculatedValues || calculateATR(candles, this.config.params.period || 14);

        const data = candles.map((c, i) => {
            const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
            const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            return {
                time: time as any,
                value: atrValues[i]
            };
        }).filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        // Ensure we have enough data
        if (candles.length < (this.config.params.period || 14)) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const atrValues = calculateATR(prices, this.config.params.period || 14);
        const lastVal = atrValues[atrValues.length - 1];

        if (!isNaN(lastVal)) {
            const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
            const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            try {
                this.series.update({
                    time: candleTime as any,
                    value: lastVal
                });
            } catch (err) { }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            safeRemoveSeries(this.chart, this.series, 'ATR');
            this.series = null;
        }
    }
}
