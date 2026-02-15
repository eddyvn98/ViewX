import { ISeriesApi, SeriesMarker, createSeriesMarkers, ISeriesMarkersPluginApi } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateRSI } from '../utils/indicator-math';
import { toSec } from '../utils/time-utils';

export class SignalIndicator {
    private markersPlugin: ISeriesMarkersPluginApi<any> | null = null;

    constructor(
        private series: ISeriesApi<"Candlestick">,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig, calculatedValues?: number[]) {
        this.config = config;

        // Auto-initialize plugin if needed
        if (!this.markersPlugin && this.series) {
            try {
                this.markersPlugin = createSeriesMarkers(this.series);
            } catch (err) {
                console.error('[Signals] Failed to create markers plugin:', err);
            }
        }

        if (!this.config.visible) {
            if (this.markersPlugin) {
                this.markersPlugin.setMarkers([]);
            }
            return;
        }

        if (candles.length < 2) return;

        const rsi14 = calculatedValues || calculateRSI(candles.map(c => c.close), 14);
        const markers: SeriesMarker<any>[] = [];

        for (let i = 2; i < candles.length; i++) {
            const prev = rsi14[i - 1];
            if (prev === undefined || isNaN(prev)) continue;

            const candleTime = toSec(candles[i].time) as any;

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

        if (this.markersPlugin) {
            try {
                this.markersPlugin.setMarkers(markers);
            } catch (err) {
                console.error('[Signals] Setting markers failed:', err);
            }
        }
    }

    destroy() {
        if (this.markersPlugin) {
            try {
                this.markersPlugin.detach();
            } catch (err) {
                console.warn('[Signals] Failed to detach markers plugin:', err);
            }
            this.markersPlugin = null;
        }
    }
}
