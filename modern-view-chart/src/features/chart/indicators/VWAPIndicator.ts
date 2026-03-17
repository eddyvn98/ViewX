import { IChartApi, ISeriesApi, LineData, LineSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateVWAP } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class VWAPIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getLineWidth(): 1 | 2 | 3 | 4 {
        const styleWidth = this.config.styles?.width;
        const width = typeof styleWidth === 'number' && Number.isFinite(styleWidth)
            ? styleWidth
            : this.config.lineWidth || 1;

        if (width >= 4) return 4;
        if (width <= 1) return 1;
        return Math.round(width) as 1 | 2 | 3 | 4;
    }

    private getCandleTime(candle: Candle): Time {
        const rawTime = Number(candle.time);
        return (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const lineColor = this.getStyleString('line', '#FFEB3B');
        const lineWidth = this.getLineWidth();

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: lineColor,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                visible: this.config.visible,
            });
        } else {
            this.series.applyOptions({
                color: lineColor,
                lineWidth,
                visible: this.config.visible,
            });
        }

        const vwapValues = calculatedValues || calculateVWAP(candles);

        const data: LineData<Time>[] = candles.map((c, i) => {
            return {
                time: this.getCandleTime(c),
                value: vwapValues[i]
            };
        }).filter(d => !isNaN(d.value));

        this.series.setData(data);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const vwapValues = calculateVWAP(prices);
        const lastVal = vwapValues[vwapValues.length - 1];

        if (!isNaN(lastVal)) {
            try {
                this.series.update({
                    time: this.getCandleTime(candle),
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
