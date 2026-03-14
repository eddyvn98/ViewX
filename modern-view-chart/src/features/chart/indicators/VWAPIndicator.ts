import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateVWAP } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class VWAPIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const styles = this.config.styles || {};
        const lineColor = styles.line || '#FFEB3B';
        const lineWidth = styles.width || 1;

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: lineColor,
                lineWidth: lineWidth as any,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                visible: this.config.visible,
            });
        } else {
            this.series.applyOptions({
                color: lineColor,
                lineWidth: lineWidth as any,
                visible: this.config.visible,
            });
        }

        const vwapValues = calculatedValues || calculateVWAP(candles);

        const data = candles.map((c, i) => {
            const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
            const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            return {
                time: time as any,
                value: vwapValues[i]
            };
        }).filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const vwapValues = calculateVWAP(prices);
        const lastVal = vwapValues[vwapValues.length - 1];

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
            safeRemoveSeries(this.chart, this.series, 'VWAP');
            this.series = null;
        }
    }
}
