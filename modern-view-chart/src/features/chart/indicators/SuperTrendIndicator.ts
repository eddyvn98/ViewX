import { IChartApi, ISeriesApi, LineData, LineSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateSuperTrend } from '../utils/indicator-math';
import { SuperTrendResult } from '../utils/indicators/supertrend';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class SuperTrendIndicator {
    private series: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getNumberParam(key: string, fallback: number): number {
        const value = this.config.params[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    private getLineWidth(): 1 | 2 | 3 | 4 {
        const styleWidth = this.config.styles?.width;
        const width = typeof styleWidth === 'number' && Number.isFinite(styleWidth)
            ? styleWidth
            : this.config.lineWidth;

        if (width >= 4) return 4;
        if (width <= 1) return 1;
        return Math.round(width) as 1 | 2 | 3 | 4;
    }

    private getCandleTime(candle: Candle): Time {
        const rawTime = Number(candle.time);
        return (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: SuperTrendResult) {
        this.config = config;

        const bullColor = this.getStyleString('bullColor', '#00ff88');
        const bearColor = this.getStyleString('bearColor', '#ff4444');
        const lineWidth = this.getLineWidth();

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
                lineWidth,
                visible: this.config.visible,
            });
        }

        const res = calculatedValues || calculateSuperTrend(
            candles,
            this.getNumberParam('period', 10),
            this.getNumberParam('multiplier', 3)
        );

        const data: LineData<Time>[] = candles.map((c, i) => {
            return {
                time: this.getCandleTime(c),
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
            this.getNumberParam('period', 10),
            this.getNumberParam('multiplier', 3)
        );

        const lastIdx = res.superTrend.length - 1;
        const candleTime = this.getCandleTime(candle);
        const bullColor = this.getStyleString('bullColor', '#00ff88');
        const bearColor = this.getStyleString('bearColor', '#ff4444');

        if (!isNaN(res.superTrend[lastIdx])) {
            try {
                this.series.update({
                    time: candleTime,
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
