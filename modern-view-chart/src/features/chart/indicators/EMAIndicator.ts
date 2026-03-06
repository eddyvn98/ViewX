import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateEMA, calculateSMA } from '../utils/indicator-math';

type IndicatorPoint = { time: any; value: number; color: string };
type SegmentMeta = {
    series: ISeriesApi<'Line'>;
    color: string;
    data: Array<{ time: any; value: number }>;
};

export class EMAIndicator {
    private segments: SegmentMeta[] = [];
    private points: IndicatorPoint[] = [];

    constructor(
        private chart: IChartApi,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        const points = this.buildPoints(candles, calculatedValues);
        this.points = points;
        this.clearSegments();
        if (!this.config.visible || points.length === 0) return;

        const lineWidth = this.getLineWidth();
        let currentColor = points[0].color;
        let segment = [{ time: points[0].time, value: points[0].value }];

        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            if (point.color === currentColor) {
                segment.push({ time: point.time, value: point.value });
                continue;
            }

            this.createSegment(segment, currentColor, lineWidth);
            const prev = segment[segment.length - 1];
            segment = [
                { time: prev.time, value: prev.value },
                { time: point.time, value: point.value },
            ];
            currentColor = point.color;
        }

        this.createSegment(segment, currentColor, lineWidth);
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        if (!this.config.visible || candles.length < this.config.params.period) return;
        if (this.points.length === 0 || this.segments.length === 0) {
            this.update(candles, this.config);
            return;
        }

        const points = this.buildPoints(candles, undefined, candle);
        if (points.length === 0) return;

        this.points = points;
        const lastIndex = points.length - 1;
        const lastPoint = points[lastIndex];
        const prevPoint = points[lastIndex - 1];
        const lastSegment = this.segments[this.segments.length - 1];
        const prevSegment = this.segments[this.segments.length - 2];

        if (!prevPoint || !lastSegment) {
            this.update(candles.slice(0, -1).concat(candle), this.config);
            return;
        }

        const lastDataPoint = { time: lastPoint.time, value: lastPoint.value };

        if (prevPoint.color === lastPoint.color) {
            if (lastSegment.color === lastPoint.color) {
                lastSegment.data[lastSegment.data.length - 1] = lastDataPoint;
                lastSegment.series.update(lastDataPoint as any);
                return;
            }

            if (prevSegment) {
                prevSegment.data = [...prevSegment.data, lastDataPoint];
                prevSegment.series.setData(prevSegment.data as any);
                this.removeLastSegment();
                return;
            }
        }

        const tailData = [
            { time: prevPoint.time, value: prevPoint.value },
            lastDataPoint,
        ];

        if (lastSegment.color === lastPoint.color) {
            lastSegment.data = tailData;
            lastSegment.series.setData(tailData as any);
            return;
        }

        if (lastSegment.color === prevPoint.color) {
            if (lastSegment.data.length > 1) {
                lastSegment.data = lastSegment.data.slice(0, -1);
                lastSegment.series.setData(lastSegment.data as any);
            }
            this.createSegment(tailData, lastPoint.color, this.getLineWidth());
            return;
        }

        this.update(candles.slice(0, -1).concat(candle), this.config);
    }

    destroy() {
        this.clearSegments();
        this.points = [];
    }

    private buildPoints(candles: Candle[], calculatedValues?: number[], lastCandleOverride?: Candle): IndicatorPoint[] {
        const styles = this.config.styles || {};
        const aboveLineColor = styles.aboveLine || styles.aboveColor || '#22c55e';
        const belowLineColor = styles.belowLine || styles.belowColor || '#ef4444';
        const inputCandles = lastCandleOverride
            ? candles.map((entry, index) => (index === candles.length - 1 ? lastCandleOverride : entry))
            : candles;

        const maValues = calculatedValues || (
            this.config.type === 'SMA'
                ? calculateSMA(inputCandles.map(c => c.close), this.config.params.period)
                : calculateEMA(inputCandles.map(c => c.close), this.config.params.period)
        );

        return inputCandles
            .map((c, index) => {
                const rawTime = typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time);
                const time = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
                const value = maValues[index];
                if (isNaN(value)) return null;
                return {
                    time: time as any,
                    value,
                    color: c.close >= value ? aboveLineColor : belowLineColor,
                };
            })
            .filter((point): point is IndicatorPoint => point !== null);
    }

    private getLineWidth() {
        const styles = this.config.styles || {};
        return styles.width || this.config.lineWidth || 2;
    }

    private createSegment(data: Array<{ time: any; value: number }>, color: string, width: number) {
        const series = this.chart.addSeries(LineSeries, {
            color,
            lineWidth: width as any,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            visible: true,
        });
        series.setData(data as any);
        this.segments.push({
            series,
            color,
            data: [...data],
        });
    }

    private removeLastSegment() {
        const segment = this.segments.pop();
        if (!segment) return;
        try {
            this.chart.removeSeries(segment.series);
        } catch { }
    }

    private clearSegments() {
        this.segments.forEach(segment => {
            try {
                this.chart.removeSeries(segment.series);
            } catch { }
        });
        this.segments = [];
    }
}
