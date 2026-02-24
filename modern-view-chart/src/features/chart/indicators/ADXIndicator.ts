import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateADX } from '../utils/indicator-math';

export class ADXIndicator {
    private adxSeries: ISeriesApi<"Line"> | null = null;
    private plusSeries: ISeriesApi<"Line"> | null = null;
    private minusSeries: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: any) {
        this.config = config;

        const styles = this.config.styles || {};
        const adxColor = styles.adxLine || '#FFB74D';
        const plusColor = styles.plusDI || '#26a69a';
        const minusColor = styles.minusDI || '#ef5350';
        const lineWidth = styles.width || 2;

        if (!this.adxSeries) {
            this.adxSeries = this.chart.addSeries(LineSeries, {
                color: adxColor,
                lineWidth: lineWidth as any,
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
            this.adxSeries.applyOptions({ color: adxColor, lineWidth: lineWidth as any, visible: this.config.visible });
            this.plusSeries!.applyOptions({ color: plusColor, visible: this.config.visible });
            this.minusSeries!.applyOptions({ color: minusColor, visible: this.config.visible });
        }

        const res = calculatedValues || calculateADX(candles, this.config.params.period || 14);

        const adxData = [];
        const plusData = [];
        const minusData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = (typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time));
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as any;

            if (!isNaN(res.adx[i])) adxData.push({ time, value: res.adx[i] });
            if (!isNaN(res.plusDI[i])) plusData.push({ time, value: res.plusDI[i] });
            if (!isNaN(res.minusDI[i])) minusData.push({ time, value: res.minusDI[i] });
        }

        this.adxSeries.setData(adxData);
        this.plusSeries!.setData(plusData);
        this.minusSeries!.setData(minusData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.adxSeries || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const res = calculateADX(prices, this.config.params.period || 14);
        const lastIdx = res.adx.length - 1;
        const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            if (!isNaN(res.adx[lastIdx])) this.adxSeries.update({ time: candleTime as any, value: res.adx[lastIdx] });
            if (!isNaN(res.plusDI[lastIdx])) this.plusSeries!.update({ time: candleTime as any, value: res.plusDI[lastIdx] });
            if (!isNaN(res.minusDI[lastIdx])) this.minusSeries!.update({ time: candleTime as any, value: res.minusDI[lastIdx] });
        } catch (err) { }
    }

    destroy() {
        if (this.chart) {
            if (this.adxSeries) this.chart.removeSeries(this.adxSeries);
            if (this.plusSeries) this.chart.removeSeries(this.plusSeries);
            if (this.minusSeries) this.chart.removeSeries(this.minusSeries);
            this.adxSeries = null;
            this.plusSeries = null;
            this.minusSeries = null;
        }
    }
}
