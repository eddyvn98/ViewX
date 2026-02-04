import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';

export class RSIIndicator {
    private series: ISeriesApi<"Line"> | null = null;
    private hasFitted = false;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;
        const period = this.config.params.period || 14;

        // Không đủ data thì không render
        if (candles.length < period) {
            if (this.series) {
                this.series.setData([]);
            }
            return;
        }

        // ===== INIT SERIES =====
        if (!this.series) {
            this.series = this.chart.addSeries(LineSeries, {
                color: this.config.color,
                lineWidth: 2,
                priceScaleId: 'right', // ✅ Sử dụng right scale mặc định
                visible: this.config.visible,
                lastValueVisible: false,
                priceLineVisible: false,

                // ✅ FIX CHÍ MẠNG: KHÓA RSI 0–100 ĐÚNG API
                autoscaleInfoProvider: () => ({
                    priceRange: {
                        minValue: 0,
                        maxValue: 100,
                    },
                }),
            });

            // Upper / Lower lines
            this.series.createPriceLine({
                price: this.config.params.upperLimit || 70,
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: '70',
            });

            this.series.createPriceLine({
                price: this.config.params.lowerLimit || 30,
                color: '#22c55e',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: '30',
            });
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
                lastValueVisible: false,
            });
        }

        if (!this.series) return;

        // ===== DATA =====
        const closePrices = candles.map(c => c.close);
        const rsiValues = calculateRSI(closePrices, period);

        const seriesData = candles
            .map((c, i) => {
                const v = rsiValues[i];
                if (!Number.isFinite(v)) return null;
                return {
                    time: c.time as any,
                    value: v,
                };
            })
            .filter(
                (p): p is { time: any; value: number } => p !== null
            );

        this.series.setData(seriesData);
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
