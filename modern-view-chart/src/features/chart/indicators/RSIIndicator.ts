import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';

export class RSIIndicator {
    private series: ISeriesApi<"Line"> | null = null;
    private upperLine: any = null;
    private lowerLine: any = null;

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
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                priceFormat: {
                    type: 'custom',
                    formatter: (v: number) => v.toFixed(0),
                },
                autoscaleInfoProvider: () => ({
                    priceRange: {
                        minValue: 0,
                        maxValue: 100,
                    },
                }),
            });

            this.chart.priceScale('right').applyOptions({
                visible: true,
                autoScale: true, // 🔴 PHẢI true
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
            });
        }

        const closePrices = candles.map(c => c.close);
        const rsiValues = calculateRSI(closePrices, this.config.params.period);

        const firstValidIdx = rsiValues.findIndex(v => !isNaN(v));
        const firstValidValue = firstValidIdx !== -1 ? rsiValues[firstValidIdx] : 50;

        const data = candles.map((c, i) => {
            let val = rsiValues[i];
            // Backfill up to 14 fake values before the first valid RSI point
            if (isNaN(val) && firstValidIdx !== -1 && i >= firstValidIdx - 14) {
                val = firstValidValue;
            }
            return {
                time: c.time as any,
                value: val
            };
        }).filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    destroy() {
        if (this.series && this.chart) {
            try {
                this.chart.removeSeries(this.series);
            } catch (err) {
                console.warn('[RSI] Failed to remove series:', err);
            }
            this.series = null;
        }
    }
}
