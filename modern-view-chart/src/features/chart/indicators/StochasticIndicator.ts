import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateStochastic } from '../utils/indicator-math';

export class StochasticIndicator {
    private kSeries: ISeriesApi<"Line"> | null = null;
    private dSeries: ISeriesApi<"Line"> | null = null;
    private upperLine: any = null;
    private lowerLine: any = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        const styles = this.config.styles || {};
        const kColor = styles.kLine || '#2196F3';
        const dColor = styles.dLine || '#FF6D00';

        if (!this.kSeries) {
            this.kSeries = this.chart.addSeries(LineSeries, {
                color: kColor,
                lineWidth: 2,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
                autoscaleInfoProvider: () => ({
                    priceRange: { minValue: 0, maxValue: 100 },
                }),
            });

            this.dSeries = this.chart.addSeries(LineSeries, {
                color: dColor,
                lineWidth: 2,
                priceScaleId: 'right',
                visible: this.config.visible,
                lastValueVisible: true,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });

            // Set Price Lines (80/20 or custom)
            this.upperLine = this.kSeries.createPriceLine({
                price: 80,
                color: styles.upperBand || '#ef5350',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
            });

            this.lowerLine = this.kSeries.createPriceLine({
                price: 20,
                color: styles.lowerBand || '#26a69a',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
            });
        } else {
            this.kSeries.applyOptions({ color: kColor, visible: this.config.visible });
            this.dSeries!.applyOptions({ color: dColor, visible: this.config.visible });
        }

        const res = calculateStochastic(
            candles.map(c => c.high),
            candles.map(c => c.low),
            candles.map(c => c.close),
            this.config.params.periodK || 14,
            this.config.params.smoothK || 3,
            this.config.params.periodD || 3
        );

        const kData = [];
        const dData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = (typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time));
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as any;

            if (!isNaN(res.k[i])) kData.push({ time, value: res.k[i] });
            if (!isNaN(res.d[i])) dData.push({ time, value: res.d[i] });
        }

        this.kSeries.setData(kData);
        this.dSeries!.setData(dData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.kSeries || !this.config.visible) return;

        const pricesHigh = candles.map(c => c.high);
        const pricesLow = candles.map(c => c.low);
        const pricesClose = candles.map(c => c.close);

        pricesHigh[pricesHigh.length - 1] = candle.high;
        pricesLow[pricesLow.length - 1] = candle.low;
        pricesClose[pricesClose.length - 1] = candle.close;

        const res = calculateStochastic(
            pricesHigh,
            pricesLow,
            pricesClose,
            this.config.params.periodK || 14,
            this.config.params.smoothK || 3,
            this.config.params.periodD || 3
        );

        const lastIdx = res.k.length - 1;
        const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            if (!isNaN(res.k[lastIdx])) this.kSeries.update({ time: candleTime as any, value: res.k[lastIdx] });
            if (!isNaN(res.d[lastIdx])) this.dSeries!.update({ time: candleTime as any, value: res.d[lastIdx] });
        } catch (err) { }
    }

    destroy() {
        if (this.chart) {
            if (this.kSeries) this.chart.removeSeries(this.kSeries);
            if (this.dSeries) this.chart.removeSeries(this.dSeries);
            this.kSeries = null;
            this.dSeries = null;
        }
    }
}
