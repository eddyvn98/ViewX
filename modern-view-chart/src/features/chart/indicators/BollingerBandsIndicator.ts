import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateBollingerBands } from '../utils/indicator-math';

export class BollingerBandsIndicator {
    private middleSeries: ISeriesApi<"Line"> | null = null;
    private upperSeries: ISeriesApi<"Line"> | null = null;
    private lowerSeries: ISeriesApi<"Line"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        const styles = this.config.styles || {};
        const middleColor = styles.middleLine || '#FFB74D';
        const upperColor = styles.upperLine || '#2196F3';
        const lowerColor = styles.lowerLine || '#2196F3';

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
            this.config.params.period || 20,
            this.config.params.stdDev || 2
        );

        const middleData = [];
        const upperData = [];
        const lowerData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = (typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time));
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as any;

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
            this.config.params.period || 20,
            this.config.params.stdDev || 2
        );

        const lastIdx = res.middle.length - 1;
        const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            if (!isNaN(res.middle[lastIdx])) this.middleSeries.update({ time: candleTime as any, value: res.middle[lastIdx] });
            if (!isNaN(res.upper[lastIdx])) this.upperSeries!.update({ time: candleTime as any, value: res.upper[lastIdx] });
            if (!isNaN(res.lower[lastIdx])) this.lowerSeries!.update({ time: candleTime as any, value: res.lower[lastIdx] });
        } catch (err) { }
    }

    destroy() {
        if (this.chart) {
            if (this.middleSeries) this.chart.removeSeries(this.middleSeries);
            if (this.upperSeries) this.chart.removeSeries(this.upperSeries);
            if (this.lowerSeries) this.chart.removeSeries(this.lowerSeries);
            this.middleSeries = null;
            this.upperSeries = null;
            this.lowerSeries = null;
        }
    }
}
