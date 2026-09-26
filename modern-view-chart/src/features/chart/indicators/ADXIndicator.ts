import { IChartApi, ISeriesApi, LineSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateADX } from '../utils/indicator-math';
import { ADXResult } from '../utils/indicators/adx';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class ADXIndicator {
    private adxSeries: ISeriesApi<"Line"> | null = null;
    private plusSeries: ISeriesApi<"Line"> | null = null;
    private minusSeries: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getStyleNumber(key: string, fallback: number): number {
        const value = this.config.styles?.[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    private getPeriod(defaultPeriod: number): number {
        const value = this.config.params.period;
        return typeof value === 'number' && Number.isFinite(value) ? value : defaultPeriod;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: ADXResult) {
        this.config = config;

        const adxColor = this.getStyleString('adxLine', '#FFB74D');
        const plusColor = this.getStyleString('plusDI', '#26a69a');
        const minusColor = this.getStyleString('minusDI', '#ef5350');
        const lineWidth = this.getStyleNumber('width', 2) as 1 | 2 | 3 | 4;

        if (!this.adxSeries) {
            this.adxSeries = this.chart.addSeries(LineSeries, {
                color: adxColor,
                lineWidth,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
                autoscaleInfoProvider: () => ({
                    priceRange: { minValue: 0, maxValue: 100 },
                }),
            });

            this.plusSeries = this.chart.addSeries(LineSeries, {
                color: plusColor,
                lineWidth: 1,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });

            this.minusSeries = this.chart.addSeries(LineSeries, {
                color: minusColor,
                lineWidth: 1,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });
        } else {
            this.adxSeries.applyOptions({ color: adxColor, lineWidth, visible: this.config.visible });
            this.plusSeries!.applyOptions({ color: plusColor, visible: this.config.visible });
            this.minusSeries!.applyOptions({ color: minusColor, visible: this.config.visible });
        }

        const res = calculatedValues || calculateADX(candles, this.getPeriod(14));

        const adxData = [];
        const plusData = [];
        const minusData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = Number(candles[i].time);
            const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

            const t = time as Time;
            if (!isNaN(res.adx[i])) adxData.push({ time: t, value: res.adx[i] });
            if (!isNaN(res.plusDI[i])) plusData.push({ time: t, value: res.plusDI[i] });
            if (!isNaN(res.minusDI[i])) minusData.push({ time: t, value: res.minusDI[i] });
        }

        this.adxSeries.setData(adxData);
        this.plusSeries!.setData(plusData);
        this.minusSeries!.setData(minusData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.adxSeries || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const res = calculateADX(prices, this.getPeriod(14));
        const lastIdx = res.adx.length - 1;
        const rawTime = Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            const t = candleTime as Time;
            if (!isNaN(res.adx[lastIdx])) this.adxSeries.update({ time: t, value: res.adx[lastIdx] });
            if (!isNaN(res.plusDI[lastIdx])) this.plusSeries!.update({ time: t, value: res.plusDI[lastIdx] });
            if (!isNaN(res.minusDI[lastIdx])) this.minusSeries!.update({ time: t, value: res.minusDI[lastIdx] });
        } catch { }
    }

    destroy() {
        if (this.chart) {
            safeRemoveSeries(this.chart, this.adxSeries, 'ADXIndicator');
            safeRemoveSeries(this.chart, this.plusSeries, 'ADXIndicator');
            safeRemoveSeries(this.chart, this.minusSeries, 'ADXIndicator');
            this.adxSeries = null;
            this.plusSeries = null;
            this.minusSeries = null;
        }
    }
}
