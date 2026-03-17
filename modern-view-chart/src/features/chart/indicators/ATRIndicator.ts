import { IChartApi, ISeriesApi, LineSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateATR } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class ATRIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getStyleNumber(key: string, fallback: number): number {
        const value = this.config.styles?.[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    private getPeriod(defaultPeriod: number): number {
        const value = this.config.params.period;
        return typeof value === 'number' && Number.isFinite(value) ? value : defaultPeriod;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const lineColor = this.getStyleString('line', this.config.color || '#f06292');
        const lineWidth = this.getStyleNumber('width', this.config.lineWidth || 2) as 1 | 2 | 3 | 4;

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: lineColor,
                lineWidth,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });
        } else {
            this.series.applyOptions({
                color: lineColor,
                lineWidth,
                visible: this.config.visible,
            });
        }

        const atrValues = calculatedValues || calculateATR(candles, this.getPeriod(14));

        const data = candles.map((c, i) => {
            const rawTime = Number(c.time);
            const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            return {
                time: time as Time,
                value: atrValues[i]
            };
        }).filter(d => !isNaN(d.value));

        this.series.setData(data);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        // Ensure we have enough data
        if (candles.length < this.getPeriod(14)) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const atrValues = calculateATR(prices, this.getPeriod(14));
        const lastVal = atrValues[atrValues.length - 1];

        if (!isNaN(lastVal)) {
            const rawTime = Number(candle.time);
            const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            try {
                this.series.update({
                    time: candleTime as Time,
                    value: lastVal
                });
            } catch { }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            safeRemoveSeries(this.chart, this.series, 'ATR');
            this.series = null;
        }
    }
}
