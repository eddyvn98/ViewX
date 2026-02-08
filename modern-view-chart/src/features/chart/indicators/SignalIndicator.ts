import { ISeriesApi, SeriesMarker } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';

export class SignalIndicator {
    constructor(
        private series: ISeriesApi<"Candlestick">,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        if (!this.config.visible) {
            if (typeof (this.series as any).setMarkers === 'function') {
                (this.series as any).setMarkers([]);
            }
            return;
        }

        const closePrices = candles.map(c => c.close);
        const rsi14 = calculateRSI(closePrices, 14);
        const markers: SeriesMarker<any>[] = [];

        for (let i = 2; i < candles.length; i++) {
            const prev = rsi14[i - 1];
            if (isNaN(prev)) continue;

            const candleTime = (typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time)) as any;

            if (prev > (this.config.params.upperLimit || 60)) {
                markers.push({
                    time: candleTime,
                    position: 'belowBar',
                    color: '#22c55e',
                    shape: 'arrowUp',
                    text: 'HBULL'
                });
            } else if (prev < (this.config.params.lowerLimit || 40)) {
                markers.push({
                    time: candleTime,
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: 'HBEAR'
                });
            }
        }

        const markersMethod = (this.series as any).setMarkers || (this.series as any).createSeriesMarkers || (this.series as any).addMarkers;

        if (typeof markersMethod === 'function') {
            try {
                markersMethod.call(this.series, markers);
            } catch (err) {
                console.error('[Signals] Setting markers failed:', err);
            }
        }
    }

    destroy() {
        if (this.series && typeof (this.series as any).setMarkers === 'function') {
            try {
                (this.series as any).setMarkers([]);
            } catch (err) {
                console.warn('[Signals] Failed to clear markers:', err);
            }
        }
    }
}
