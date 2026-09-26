import { IChartApi, ISeriesApi, LineSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateIchimoku } from '../utils/indicator-math';
import { IchimokuResult } from '../utils/indicators/ichimoku';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class IchimokuIndicator {
    private tenkanSeries: ISeriesApi<"Line"> | null = null;
    private kijunSeries: ISeriesApi<"Line"> | null = null;
    private spanASeries: ISeriesApi<"Line"> | null = null;
    private spanBSeries: ISeriesApi<"Line"> | null = null;
    private chikouSeries: ISeriesApi<"Line"> | null = null;
    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getNumberParam(key: string, fallback: number): number {
        const value = this.config.params[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: IchimokuResult) {
        this.config = config;

        const tenkanColor = this.getStyleString('tenkanLine', '#2196F3');
        const kijunColor = this.getStyleString('kijunLine', '#FF6D00');
        const spanAColor = this.getStyleString('spanALine', '#26a69a');
        const spanBColor = this.getStyleString('spanBLine', '#ef5350');
        const chikouColor = this.getStyleString('chikouLine', '#9c27b0');

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
            this.getNumberParam('tenkan', 9),
            this.getNumberParam('kijun', 26),
            this.getNumberParam('spanB', 52),
            this.getNumberParam('displacement', 26)
        );

        const tData = [];
        const kData = [];
        const aData = [];
        const bData = [];
        const cData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = Number(candles[i].time);
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;

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
            this.getNumberParam('tenkan', 9),
            this.getNumberParam('kijun', 26),
            this.getNumberParam('spanB', 52),
            this.getNumberParam('displacement', 26)
        );

        const lastIdx = res.tenkan.length - 1;
        const rawTime = Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            const t = candleTime as Time;
            if (!isNaN(res.tenkan[lastIdx])) this.tenkanSeries.update({ time: t, value: res.tenkan[lastIdx] });
            if (!isNaN(res.kijun[lastIdx])) this.kijunSeries!.update({ time: t, value: res.kijun[lastIdx] });
            if (!isNaN(res.spanA[lastIdx])) this.spanASeries!.update({ time: t, value: res.spanA[lastIdx] });
            if (!isNaN(res.spanB[lastIdx])) this.spanBSeries!.update({ time: t, value: res.spanB[lastIdx] });
            if (!isNaN(res.chikou[lastIdx])) this.chikouSeries!.update({ time: t, value: res.chikou[lastIdx] });
        } catch { }
    }

    destroy() {
        if (this.chart) {
            if (this.tenkanSeries) safeRemoveSeries(this.chart, this.tenkanSeries, 'Ichimoku');
            if (this.kijunSeries) safeRemoveSeries(this.chart, this.kijunSeries, 'Ichimoku');
            if (this.spanASeries) safeRemoveSeries(this.chart, this.spanASeries, 'Ichimoku');
            if (this.spanBSeries) safeRemoveSeries(this.chart, this.spanBSeries, 'Ichimoku');
            if (this.chikouSeries) safeRemoveSeries(this.chart, this.chikouSeries, 'Ichimoku');
            this.tenkanSeries = null;
            this.kijunSeries = null;
            this.spanASeries = null;
            this.spanBSeries = null;
            this.chikouSeries = null;
        }
    }
}
