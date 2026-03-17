import { HistogramData, IChartApi, ISeriesApi, LineData, LineSeries, HistogramSeries, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateMACD } from '../utils/indicator-math';
import { MACDResult } from '@/features/strategy/types';
import { safeRemoveSeries } from './utils/safe-remove-series';

export class MACDIndicator {
    private macdSeries: ISeriesApi<"Line"> | null = null;
    private signalSeries: ISeriesApi<"Line"> | null = null;
    private histogramSeries: ISeriesApi<"Histogram"> | null = null;

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

    private getLineWidth(): 1 | 2 | 3 | 4 {
        const styleWidth = this.config.styles?.width;
        const width = typeof styleWidth === 'number' && Number.isFinite(styleWidth)
            ? styleWidth
            : this.config.lineWidth;

        if (width >= 4) return 4;
        if (width <= 1) return 1;
        return Math.round(width) as 1 | 2 | 3 | 4;
    }

    private getCandleTime(candle: Candle): Time {
        const rawTime = Number(candle.time);
        return (rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;
    }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: MACDResult) {
        this.config = config;

        const macdColor = this.getStyleString('macdLine', '#2962FF');
        const signalColor = this.getStyleString('signalLine', '#FF6D00');
        const histogramBullColor = this.getStyleString('histogramBull', '#26a69a');
        const histogramBearColor = this.getStyleString('histogramBear', '#ef5350');
        const lineWidth = this.getLineWidth();

        // Initialize Series if not exists
        if (!this.macdSeries) {
            // Histogram (Background)
            this.histogramSeries = this.chart.addSeries(HistogramSeries, {
                color: histogramBullColor,
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
                lineWidth,
                priceScaleId: 'right',
                visible: this.config.visible,
                crosshairMarkerVisible: false,
            });

            // Signal Line (Slow)
            this.signalSeries = this.chart.addSeries(LineSeries, {
                color: signalColor,
                lineWidth,
                priceScaleId: 'right',
                visible: this.config.visible,
                crosshairMarkerVisible: false,
            });
        } else {
            // Update visibility and styles
            this.macdSeries.applyOptions({ visible: this.config.visible, color: macdColor, lineWidth });
            this.signalSeries!.applyOptions({ visible: this.config.visible, color: signalColor, lineWidth });
            this.histogramSeries!.applyOptions({
                visible: this.config.visible,
                color: histogramBullColor
            });
        }

        // Calculate Data
        const fast = this.getNumberParam('fast', 12);
        const slow = this.getNumberParam('slow', 26);
        const signal = this.getNumberParam('signal', 9);
        const { macd, signal: sig, histogram } = calculatedValues || calculateMACD(candles.map(c => c.close), fast, slow, signal);

        // Format Data
        const macdData: LineData<Time>[] = [];
        const signalData: LineData<Time>[] = [];
        const histogramData: HistogramData<Time>[] = [];

        for (let i = 0; i < candles.length; i++) {
            const time = this.getCandleTime(candles[i]);

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
                    color: histogram[i] >= 0 ? histogramBullColor : histogramBearColor
                });
            }
        }

        // Set Data
        this.macdSeries.setData(macdData);
        this.signalSeries!.setData(signalData);
        this.histogramSeries!.setData(histogramData);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.macdSeries || !this.signalSeries || !this.histogramSeries || !this.config.visible) return;

        const fast = this.getNumberParam('fast', 12);
        const slow = this.getNumberParam('slow', 26);
        const signal = this.getNumberParam('signal', 9);
        if (candles.length < slow) return;

        const histogramBullColor = this.getStyleString('histogramBull', '#26a69a');
        const histogramBearColor = this.getStyleString('histogramBear', '#ef5350');

        const prices = candles.map(c => c.close);
        prices[prices.length - 1] = candle.close;

        const { macd, signal: sig, histogram } = calculateMACD(prices, fast, slow, signal);

        const lastIdxMACD = macd.length - 1;
        const candleTime = this.getCandleTime(candle);

        try {
            if (!isNaN(macd[lastIdxMACD])) {
                this.macdSeries.update({ time: candleTime, value: macd[lastIdxMACD] });
            }
            if (!isNaN(sig[lastIdxMACD])) {
                this.signalSeries.update({ time: candleTime, value: sig[lastIdxMACD] });
            }
            if (!isNaN(histogram[lastIdxMACD])) {
                this.histogramSeries.update({
                    time: candleTime,
                    value: histogram[lastIdxMACD],
                    color: histogram[lastIdxMACD] >= 0 ? histogramBullColor : histogramBearColor
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
