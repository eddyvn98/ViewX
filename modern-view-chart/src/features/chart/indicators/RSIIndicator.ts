import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';

export class RSIIndicator {
    private series: ISeriesApi<"Line"> | null = null;
    private upperLine: any = null;
    private lowerLine: any = null;
    private latestRsiValue = 50;

    private getDynamicRange() {
        const center = Number.isFinite(this.latestRsiValue) ? this.latestRsiValue : 50;
        const minValue = Math.max(0, center - 20);
        const maxValue = Math.min(100, center + 20);
        return { minValue, maxValue };
    }

    private applyDynamicScale() {
        const { minValue, maxValue } = this.getDynamicRange();
        const scale = this.chart.priceScale('right') as any;
        try {
            scale.applyOptions?.({
                visible: true,
                autoScale: false,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
            });
            scale.setVisibleRange?.({ from: minValue, to: maxValue });
        } catch {
            // Ignore transient price scale errors while chart is reconfiguring.
        }
    }

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
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false, // Disable for performance
                priceFormat: {
                    type: 'custom',
                    formatter: (v: number) => v.toFixed(0),
                },
                autoscaleInfoProvider: () => ({ priceRange: this.getDynamicRange() }),
            });

            this.chart.priceScale('right').applyOptions({
                visible: true,
                autoScale: false,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
            });

            // Add standard lines (Overbought/Oversold)
            this.upperLine = this.series.createPriceLine({
                price: this.config.params.upperLimit || 60,
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '60',
            });

            this.lowerLine = this.series.createPriceLine({
                price: this.config.params.lowerLimit || 40,
                color: '#22c55e',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '40',
            });
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
                crosshairMarkerVisible: false, // Disable for performance
            });
        }

        const rsiValues = calculatedValues || calculateRSI(candles.map(c => c.close), this.config.params.period);

        const firstValidIdx = rsiValues.findIndex(v => !isNaN(v));
        const firstValidValue = firstValidIdx !== -1 ? rsiValues[firstValidIdx] : 50;

        const data = candles.map((c, i) => {
            let val = rsiValues[i];
            // Backfill up to 14 fake values before the first valid RSI point
            if (isNaN(val) && firstValidIdx !== -1 && i >= firstValidIdx - 14) {
                val = firstValidValue;
            }
            const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
            const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            return {
                time: time as any,
                value: val
            };
        }).filter(d => !isNaN(d.value));

        if (data.length > 0) {
            this.latestRsiValue = Number(data[data.length - 1].value);
        }
        this.series.setData(data as any);
        this.applyDynamicScale();
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible || candles.length < this.config.params.period + 1) return;

        const period = this.config.params.period || 14;
        const lastIdx = candles.length - 1;

        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close;

        const rsiValues = calculateRSI(prices, period);
        const lastVal = rsiValues[rsiValues.length - 1];

        if (!isNaN(lastVal)) {
            this.latestRsiValue = Number(lastVal);
            const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
            const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            try {
                this.series.update({
                    time: candleTime as any,
                    value: lastVal
                });
                this.applyDynamicScale();
            } catch (err) { }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            try {
                this.chart.removeSeries(this.series);
                this.chart.priceScale('right').applyOptions({ autoScale: true });
            } catch (err) {
                console.warn('[RSI] Failed to remove series:', err);
            }
            this.series = null;
        }
    }
}

