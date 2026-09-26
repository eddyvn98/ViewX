import { IChartApi, ISeriesApi, LineSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateBollingerBands } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class BollingerBandsIndicator {
    private middleSeries: ISeriesApi<"Line"> | null = null;
    private upperSeries: ISeriesApi<"Line"> | null = null;
    private lowerSeries: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getPeriod(defaultPeriod: number): number {
        const value = this.config.params.period;
        return typeof value === 'number' && Number.isFinite(value) ? value : defaultPeriod;
    }

    private getStdDev(defaultValue: number): number {
        const value = this.config.params.stdDev;
        return typeof value === 'number' && Number.isFinite(value) ? value : defaultValue;
    }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        const middleColor = this.getStyleString('middleLine', '#FFB74D');
        const upperColor = this.getStyleString('upperLine', '#2196F3');
        const lowerColor = this.getStyleString('lowerLine', '#2196F3');

        if (!this.middleSeries) {
            this.middleSeries = this.chart.addSeries(LineSeries, {
                color: middleColor,
                lineWidth: 1,
                visible: this.config.visible,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            this.upperSeries = this.chart.addSeries(LineSeries, {
                color: upperColor,
                lineWidth: 1,
                visible: this.config.visible,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            this.lowerSeries = this.chart.addSeries(LineSeries, {
                color: lowerColor,
                lineWidth: 1,
                visible: this.config.visible,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
        } else {
            this.middleSeries.applyOptions({ color: middleColor, visible: this.config.visible });
            this.upperSeries!.applyOptions({ color: upperColor, visible: this.config.visible });
            this.lowerSeries!.applyOptions({ color: lowerColor, visible: this.config.visible });
        }

        const res = calculateBollingerBands(
            candles.map(c => c.close),
            this.getPeriod(20),
            this.getStdDev(2)
        );

        const middleData = [];
        const upperData = [];
        const lowerData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = Number(candles[i].time);
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;

            if (!isNaN(res.middle[i])) middleData.push({ time, value: res.middle[i] });
            if (!isNaN(res.upper[i])) upperData.push({ time, value: res.upper[i] });
            if (!isNaN(res.lower[i])) lowerData.push({ time, value: res.lower[i] });
        }

        this.middleSeries.setData(middleData);
        this.upperSeries!.setData(upperData);
        this.lowerSeries!.setData(lowerData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.middleSeries || !this.config.visible) return;

        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close;

        const res = calculateBollingerBands(
            prices,
            this.getPeriod(20),
            this.getStdDev(2)
        );

        const lastIdx = res.middle.length - 1;
        const rawTime = Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            const t = candleTime as Time;
            if (!isNaN(res.middle[lastIdx])) this.middleSeries.update({ time: t, value: res.middle[lastIdx] });
            if (!isNaN(res.upper[lastIdx])) this.upperSeries!.update({ time: t, value: res.upper[lastIdx] });
            if (!isNaN(res.lower[lastIdx])) this.lowerSeries!.update({ time: t, value: res.lower[lastIdx] });
        } catch { }
    }

    destroy() {
        if (this.chart) {
            safeRemoveSeries(this.chart, this.middleSeries, 'BollingerBandsIndicator');
            safeRemoveSeries(this.chart, this.upperSeries, 'BollingerBandsIndicator');
            safeRemoveSeries(this.chart, this.lowerSeries, 'BollingerBandsIndicator');
            this.middleSeries = null;
            this.upperSeries = null;
            this.lowerSeries = null;
        }
    }
}
