import { IChartApi, ISeriesApi, LineData, LineSeries, LineStyle, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class RSIIndicator {
    private series: ISeriesApi<"Line"> | null = null;
    private upperLine: any = null;
    private lowerLine: any = null;
    private latestRsiValue = 50;



    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

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

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;
        const lineWidth = this.getLineWidth();

        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: this.config.color,
                lineWidth,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false, // Disable for performance
                priceFormat: {
                    type: 'custom',
                    formatter: (v: number) => v.toFixed(0),
                },
            });

            this.chart.priceScale('right').applyOptions({
                visible: true,
                autoScale: false,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
            });

            this.chart.priceScale('right').setVisibleRange({ from: 0, to: 100 });

            // Add standard lines (Overbought/Oversold)
            this.upperLine = this.series.createPriceLine({
                price: this.getNumberParam('upperLimit', 60),
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '60',
            });

            this.lowerLine = this.series.createPriceLine({
                price: this.getNumberParam('lowerLimit', 40),
                color: '#22c55e',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '40',
            });
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth,
                visible: this.config.visible,
                crosshairMarkerVisible: false, // Disable for performance
            });
        }

        const rsiValues = calculatedValues || calculateRSI(candles.map(c => c.close), this.getNumberParam('period', 14));

        const firstValidIdx = rsiValues.findIndex(v => !isNaN(v));
        const firstValidValue = firstValidIdx !== -1 ? rsiValues[firstValidIdx] : 50;

        const data: LineData<Time>[] = candles.map((c, i) => {
            let val = rsiValues[i];
            // Backfill up to 14 fake values before the first valid RSI point
            if (isNaN(val) && firstValidIdx !== -1 && i >= firstValidIdx - 14) {
                val = firstValidValue;
            }
            return {
                time: this.getCandleTime(c),
                value: val
            };
        }).filter(d => !isNaN(d.value));

        if (data.length > 0) {
            this.latestRsiValue = Number(data[data.length - 1].value);
        }
        this.series.setData(data);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        const period = this.getNumberParam('period', 14);
        if (!this.series || !this.config.visible || candles.length < period + 1) return;

        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close;

        const rsiValues = calculateRSI(prices, period);
        const lastVal = rsiValues[rsiValues.length - 1];

        if (!isNaN(lastVal)) {
            this.latestRsiValue = Number(lastVal);
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
            safeRemoveSeries(this.chart, this.series, 'RSI');
            this.series = null;
        }
    }
}

