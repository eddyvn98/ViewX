import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateEMA } from '../utils/indicator-math';

export class EMAIndicator {
    private series: ISeriesApi<"Line"> | null = null;

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
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false, // Disable for performance
                visible: this.config.visible,
            });
        } else {
            this.series.applyOptions({
                color: this.config.color,
                lineWidth: this.config.lineWidth as any,
                visible: this.config.visible,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false, // Disable for performance
            });
        }

        const emaValues = calculatedValues || calculateEMA(candles.map(c => c.close), this.config.params.period);

        const data = candles
            .map((c, i) => {
                const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
                const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
                return {
                    time: time as any,
                    value: emaValues[i]
                };
            })
            .filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible || candles.length < this.config.params.period) return;

        // Very fast incremental EMA calculation for the last point
        const period = this.config.params.period;
        const alpha = 2 / (period + 1);

        // We need the PREVIOUS candle's EMA to calculate the current one
        // Since we don't store it, we have to calculate it or get it from the series
        // For simplicity here, we can recalculate just the last few points if needed, 
        // but for TRUE performance, we'd need a more stateful approach.
        // However, even a small slice calculation is way faster than the full series.

        const lastIdx = candles.length - 1;
        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close; // Ensure we use the latest price

        const emaValues = calculateEMA(prices, period);
        const lastVal = emaValues[emaValues.length - 1];

        if (!isNaN(lastVal)) {
            const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
            const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

            if (!candleTime) return;

            try {
                this.series.update({
                    time: candleTime as any,
                    value: lastVal
                });
            } catch (err) {
                // Ignore "Cannot update oldest data" errors which happen during rapid updates/race conditions
                // console.warn('EMA update failed:', err); 
            }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            try {
                this.chart.removeSeries(this.series);
            } catch (err) {
                console.warn('[EMA] Failed to remove series:', err);
            }
            this.series = null;
        }
    }
}
