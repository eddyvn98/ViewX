import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateSuperTrend } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class SuperTrendIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: any) {
        this.config = config;

        const styles = this.config.styles || {};
        const bullColor = styles.bullColor || '#00ff88';
        const bearColor = styles.bearColor || '#ff4444';
        const lineWidth = styles.width || this.config.lineWidth || 2;

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                lineWidth: lineWidth as any,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                visible: this.config.visible,
            });
        } else {
            this.series.applyOptions({
                lineWidth: lineWidth as any,
                visible: this.config.visible,
            });
        }

        const res = calculatedValues || calculateSuperTrend(
            candles,
            this.config.params.period || 10,
            this.config.params.multiplier || 3
        );

        const data = candles.map((c, i) => {
            const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
            const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            return {
                time: time as any,
                value: res.superTrend[i],
                color: res.trend[i] === 1 ? bullColor : bearColor
            };
        }).filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const res = calculateSuperTrend(
            prices,
            this.config.params.period || 10,
            this.config.params.multiplier || 3
        );

        const lastIdx = res.superTrend.length - 1;
        const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        const styles = this.config.styles || {};
        const bullColor = styles.bullColor || '#00ff88';
        const bearColor = styles.bearColor || '#ff4444';

        if (!isNaN(res.superTrend[lastIdx])) {
            try {
                this.series.update({
                    time: candleTime as any,
                    value: res.superTrend[lastIdx],
                    color: res.trend[lastIdx] === 1 ? bullColor : bearColor
                });
            } catch (err) { }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            safeRemoveSeries(this.chart, this.series, 'SuperTrend');
            this.series = null;
        }
    }
}
