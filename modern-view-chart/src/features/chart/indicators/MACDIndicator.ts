import { IChartApi, ISeriesApi, LineSeries, HistogramSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateMACD } from '../utils/indicator-math';

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

        // Initialize Series if not exists
        if (!this.macdSeries) {
            // Histogram (Background)
            this.histogramSeries = this.chart.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceScaleId: 'right',
                priceFormat: { type: 'volume' }, // or custom
                visible: this.config.visible,
            });

            // MACD Line (Fast)
            this.macdSeries = this.chart.addSeries(LineSeries, {
                color: '#2962FF', // Default Blue
                lineWidth: 2,
                priceScaleId: 'right',
                visible: this.config.visible,
                crosshairMarkerVisible: false, // Disable for performance
            });

            // Signal Line (Slow)
            this.signalSeries = this.chart.addSeries(LineSeries, {
                color: '#FF6D00', // Default Orange
                lineWidth: 2,
                priceScaleId: 'right',
                visible: this.config.visible,
                crosshairMarkerVisible: false, // Disable for performance
            });
        } else {
            // Update visibility and generic options
            const options = { visible: this.config.visible };
            this.macdSeries.applyOptions(options);
            this.signalSeries!.applyOptions(options);
            this.histogramSeries!.applyOptions(options);
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
                this.chart.removeSeries(this.macdSeries);
                this.macdSeries = null;
            }
            if (this.signalSeries) {
                this.chart.removeSeries(this.signalSeries);
                this.signalSeries = null;
            }
            if (this.histogramSeries) {
                this.chart.removeSeries(this.histogramSeries);
                this.histogramSeries = null;
            }
        }
    }
}
