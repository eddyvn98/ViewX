import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateSAR } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';
import { SARSeries } from '../logic/sar-series';

export class SARIndicator {
    private series: ISeriesApi<"Custom"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const styles = this.config.styles || {};
        const color = styles.color || '#2196F3';
        const dotSize = styles.width || 2;

        if (!this.series) {
            this.series = this.chart.addCustomSeries(new SARSeries(), {
                color: color,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                visible: this.config.visible,
                // Pass dotSize to our custom options
                dotSize: dotSize,
            } as any);
        } else {
            this.series.applyOptions({
                color: color,
                visible: this.config.visible,
                dotSize: dotSize,
            } as any);
        }

        const params = this.config.params || {};
        const sarValues = calculatedValues || calculateSAR(
            candles,
            params.startAF || 0.02,
            params.incrementAF || 0.02,
            params.maxAF || 0.20
        );

        const data = candles
            .map((c, i) => {
                const rawTime = (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time));
                const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
                return {
                    time: time as any,
                    value: sarValues[i]
                };
            })
            .filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        const params = this.config.params || {};
        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const sarValues = calculateSAR(
            prices,
            params.startAF || 0.02,
            params.incrementAF || 0.02,
            params.maxAF || 0.20
        );
        const lastVal = sarValues[sarValues.length - 1];

        if (!isNaN(lastVal)) {
            const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
            const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

            if (!candleTime) return;

            try {
                this.series.update({
                    time: candleTime as any,
                    value: lastVal
                } as any);
            } catch (err) { }
        }
    }

    destroy() {
        if (this.series && this.chart) {
            safeRemoveSeries(this.chart, this.series as any, 'SAR');
            this.series = null;
        }
    }
}
