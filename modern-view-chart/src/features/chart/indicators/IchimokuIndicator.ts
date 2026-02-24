import { IChartApi, ISeriesApi, LineSeries, AreaSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateIchimoku } from '../utils/indicator-math';

export class IchimokuIndicator {
    private tenkanSeries: ISeriesApi<"Line"> | null = null;
    private kijunSeries: ISeriesApi<"Line"> | null = null;
    private spanASeries: ISeriesApi<"Line"> | null = null;
    private spanBSeries: ISeriesApi<"Line"> | null = null;
    private chikouSeries: ISeriesApi<"Line"> | null = null;
    private cloudSeries: ISeriesApi<"Area"> | null = null; // Lightweight charts Area handles spans well, but cloud is tricky without custom primitive.
    // For now, we use standard series. Fills between Spans might require a custom primitive for best result.
    // However, we can use an AreaSeries for Span A vs Span B if we only want one color.
    // Better: use multiple series.

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: any) {
        this.config = config;

        const styles = this.config.styles || {};
        const tenkanColor = styles.tenkanLine || '#2196F3';
        const kijunColor = styles.kijunLine || '#FF6D00';
        const spanAColor = styles.spanALine || '#26a69a';
        const spanBColor = styles.spanBLine || '#ef5350';
        const chikouColor = styles.chikouLine || '#9c27b0';

        if (!this.tenkanSeries) {
            this.tenkanSeries = this.chart.addSeries(LineSeries, { color: tenkanColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: this.config.visible });
            this.kijunSeries = this.chart.addSeries(LineSeries, { color: kijunColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: this.config.visible });
            this.spanASeries = this.chart.addSeries(LineSeries, { color: spanAColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: this.config.visible });
            this.spanBSeries = this.chart.addSeries(LineSeries, { color: spanBColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: this.config.visible });
            this.chikouSeries = this.chart.addSeries(LineSeries, { color: chikouColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: this.config.visible });
        } else {
            this.tenkanSeries.applyOptions({ color: tenkanColor, visible: this.config.visible });
            this.kijunSeries!.applyOptions({ color: kijunColor, visible: this.config.visible });
            this.spanASeries!.applyOptions({ color: spanAColor, visible: this.config.visible });
            this.spanBSeries!.applyOptions({ color: spanBColor, visible: this.config.visible });
            this.chikouSeries!.applyOptions({ color: chikouColor, visible: this.config.visible });
        }

        const res = calculatedValues || calculateIchimoku(
            candles,
            this.config.params.tenkan || 9,
            this.config.params.kijun || 26,
            this.config.params.spanB || 52,
            this.config.params.displacement || 26
        );

        const tData = [];
        const kData = [];
        const aData = [];
        const bData = [];
        const cData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = (typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time));
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as any;

            if (!isNaN(res.tenkan[i])) tData.push({ time, value: res.tenkan[i] });
            if (!isNaN(res.kijun[i])) kData.push({ time, value: res.kijun[i] });
            if (!isNaN(res.spanA[i])) aData.push({ time, value: res.spanA[i] });
            if (!isNaN(res.spanB[i])) bData.push({ time, value: res.spanB[i] });
            if (!isNaN(res.chikou[i])) cData.push({ time, value: res.chikou[i] });
        }

        this.tenkanSeries.setData(tData);
        this.kijunSeries!.setData(kData);
        this.spanASeries!.setData(aData);
        this.spanBSeries!.setData(bData);
        this.chikouSeries!.setData(cData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.tenkanSeries || !this.config.visible) return;

        const prices = [...candles];
        prices[prices.length - 1] = candle;

        const res = calculateIchimoku(
            prices,
            this.config.params.tenkan || 9,
            this.config.params.kijun || 26,
            this.config.params.spanB || 52,
            this.config.params.displacement || 26
        );

        const lastIdx = res.tenkan.length - 1;
        const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            if (!isNaN(res.tenkan[lastIdx])) this.tenkanSeries.update({ time: candleTime as any, value: res.tenkan[lastIdx] });
            if (!isNaN(res.kijun[lastIdx])) this.kijunSeries!.update({ time: candleTime as any, value: res.kijun[lastIdx] });
            if (!isNaN(res.spanA[lastIdx])) this.spanASeries!.update({ time: candleTime as any, value: res.spanA[lastIdx] });
            if (!isNaN(res.spanB[lastIdx])) this.spanBSeries!.update({ time: candleTime as any, value: res.spanB[lastIdx] });
            if (!isNaN(res.chikou[lastIdx])) this.chikouSeries!.update({ time: candleTime as any, value: res.chikou[lastIdx] });
        } catch (err) { }
    }

    destroy() {
        if (this.chart) {
            if (this.tenkanSeries) this.chart.removeSeries(this.tenkanSeries);
            if (this.kijunSeries) this.chart.removeSeries(this.kijunSeries);
            if (this.spanASeries) this.chart.removeSeries(this.spanASeries);
            if (this.spanBSeries) this.chart.removeSeries(this.spanBSeries);
            if (this.chikouSeries) this.chart.removeSeries(this.chikouSeries);
            this.tenkanSeries = null;
            this.kijunSeries = null;
            this.spanASeries = null;
            this.spanBSeries = null;
            this.chikouSeries = null;
        }
    }
}
