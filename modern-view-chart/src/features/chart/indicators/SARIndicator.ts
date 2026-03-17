import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
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

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getNumberStyle(key: string, fallback: number): number {
        const value = this.config.styles?.[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    private getNumberParam(key: string, fallback: number): number {
        const value = this.config.params[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    private getCandleTime(candle: Candle): Time {
        const rawTime = Number(candle.time);
        return (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const color = this.getStyleString('color', '#2196F3');
        const dotSize = this.getNumberStyle('width', 2);

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

        const sarValues = calculatedValues || calculateSAR(
            candles,
            this.getNumberParam('startAF', 0.02),
            this.getNumberParam('incrementAF', 0.02),
            this.getNumberParam('maxAF', 0.20)
        );

        const data = candles
            .map((c, i) => {
                return {
                    time: this.getCandleTime(c),
                    value: sarValues[i]
                };
            })
            .filter(d => !isNaN(d.value));

        this.series.setData(data as any);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.series || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const sarValues = calculateSAR(
            prices,
            this.getNumberParam('startAF', 0.02),
            this.getNumberParam('incrementAF', 0.02),
            this.getNumberParam('maxAF', 0.20)
        );
        const lastVal = sarValues[sarValues.length - 1];

        if (!isNaN(lastVal)) {
            const candleTime = this.getCandleTime(candle);

            if (!candleTime) return;

            try {
                this.series.update({
                    time: candleTime,
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
