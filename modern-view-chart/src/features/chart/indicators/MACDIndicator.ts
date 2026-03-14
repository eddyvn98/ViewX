import { IChartApi, ISeriesApi, LineSeries, HistogramSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateMACD } from '../utils/indicator-math';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class MACDIndicator {
    private macdSeries: ISeriesApi<"Line"> | null = null;
    private signalSeries: ISeriesApi<"Line"> | null = null;
    private histogramSeries: ISeriesApi<"Histogram"> | null = null;

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: any) {
        this.config = config;

        const styles = this.config.styles || {};
        const macdColor = styles.macdLine || '#2962FF';
        const signalColor = styles.signalLine || '#FF6D00';

        // Initialize Series if not exists
        if (!this.macdSeries) {
            // Histogram (Background)
            this.histogramSeries = this.chart.addSeries(HistogramSeries, {
                color: styles.histogramBull || '#26a69a',
                priceScaleId: 'right',
                priceFormat: { type: 'volume' },
                visible: this.config.visible,
            });

            this.chart.priceScale('right').applyOptions({
                autoScale: true,
            });

            this.chart.priceScale('right').applyOptions({
                autoScale: true,
            });

            // MACD Line (Fast)
            this.macdSeries = this.chart.addSeries(LineSeries, {
                color: macdColor,
                lineWidth: 2,
                priceScaleId: 'right',
                visible: this.config.visible,
                crosshairMarkerVisible: false,
            });

            // Signal Line (Slow)
            this.signalSeries = this.chart.addSeries(LineSeries, {
                color: signalColor,
                lineWidth: 2,
                priceScaleId: 'right',
                visible: this.config.visible,
                crosshairMarkerVisible: false,
            });
        } else {
            // Update visibility and styles
            this.macdSeries.applyOptions({ visible: this.config.visible, color: macdColor });
            this.signalSeries!.applyOptions({ visible: this.config.visible, color: signalColor });
            this.histogramSeries!.applyOptions({
                visible: this.config.visible,
                color: styles.histogramBull || '#26a69a'
            });
        }

        // Calculate Data
        const { fast = 12, slow = 26, signal = 9 } = this.config.params;
        const { macd, signal: sig, histogram } = calculatedValues || calculateMACD(candles.map(c => c.close), fast, slow, signal);

        // Format Data
        const macdData = [];
        const signalData = [];
        const histogramData = [];

        for (let i = 0; i < candles.length; i++) {
            const rawTime = (typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time));
            const time = (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as any;

            if (!isNaN(macd[i])) {
                macdData.push({ time, value: macd[i] });
            }
            if (!isNaN(sig[i])) {
                signalData.push({ time, value: sig[i] });
            }
            if (!isNaN(histogram[i])) {
                histogramData.push({
                    time,
                    value: histogram[i],
                    color: histogram[i] >= 0 ? '#26a69a' : '#ef5350' // Green if > 0, Red if < 0
                });
            }
        }

        // Set Data
        this.macdSeries.setData(macdData);
        this.signalSeries!.setData(signalData);
        this.histogramSeries!.setData(histogramData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.macdSeries || !this.config.visible || candles.length < this.config.params.slow) return;

        const { fast = 12, slow = 26, signal = 9 } = this.config.params;
        const lastIdx = candles.length - 1;

        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close;

        const { macd, signal: sig, histogram } = calculateMACD(prices, fast, slow, signal);

        const lastIdxMACD = macd.length - 1;
        const rawTime = typeof candle.time === 'object' ? (candle.time as any).timestamp : Number(candle.time);
        const candleTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

        try {
            if (!isNaN(macd[lastIdxMACD])) {
                this.macdSeries.update({ time: candleTime as any, value: macd[lastIdxMACD] });
            }
            if (!isNaN(sig[lastIdxMACD])) {
                this.signalSeries!.update({ time: candleTime as any, value: sig[lastIdxMACD] });
            }
            if (!isNaN(histogram[lastIdxMACD])) {
                this.histogramSeries!.update({
                    time: candleTime as any,
                    value: histogram[lastIdxMACD],
                    color: histogram[lastIdxMACD] >= 0 ? '#26a69a' : '#ef5350'
                });
            }
        } catch (err) {
            // Ignore update errors
        }
    }

    destroy() {
        if (this.chart) {
            if (this.macdSeries) {
                safeRemoveSeries(this.chart, this.macdSeries, 'MACD');
                this.macdSeries = null;
            }
            if (this.signalSeries) {
                safeRemoveSeries(this.chart, this.signalSeries, 'MACD');
                this.signalSeries = null;
            }
            if (this.histogramSeries) {
                safeRemoveSeries(this.chart, this.histogramSeries, 'MACD');
                this.histogramSeries = null;
            }
        }
    }
}
