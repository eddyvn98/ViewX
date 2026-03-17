import { ISeriesApi, createSeriesMarkers, ISeriesMarkersPluginApi } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateDynamicSwingPoints } from '../logic/candle-patterns';
import { toSec } from '../utils/time-utils';

export class MarketStructureIndicator {
    private series: ISeriesApi<any> | null = null;
    private markersPlugin: ISeriesMarkersPluginApi<any> | null = null;
    private lastMarkersJson: string = '';

    constructor(
        series: ISeriesApi<any>,
        private config: IndicatorConfig
    ) {
        this.series = series;
    }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getNumberParam(key: string, fallback: number): number {
        const value = this.config.params[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;
        if (!this.series) return;

        // Map candles to CandleData expected by calculateSwingPoints
        // Note: calculateSwingPoints expects time as Time, and we need to ensure consistent formatting
        const formattedData = candles.map(c => ({
            ...c,
            time: toSec(c.time) as any
        }));

        const bullColor = this.getStyleString('bullColor', '#00ff88');
        const bearColor = this.getStyleString('bearColor', '#ff3366');

        const markers = calculateDynamicSwingPoints(
            formattedData,
            this.getNumberParam('depth', 7),
            bullColor,
            bearColor
        );

        // Auto-initialize plugin if needed
        if (!this.markersPlugin && this.series) {
            try {
                this.markersPlugin = createSeriesMarkers(this.series);
            } catch (err) {
                console.error('[MarketStructure] Failed to create markers plugin:', err);
            }
        }

        // Only set data if markers changed or visibility toggled
        const markersJson = JSON.stringify(markers);
        if (markersJson !== this.lastMarkersJson) {
            if (this.markersPlugin) {
                try {
                    this.markersPlugin.setMarkers(this.config.visible ? markers : []);
                    this.lastMarkersJson = markersJson;
                } catch (err) {
                    console.error('[MarketStructure] Error setting markers:', err);
                }
            } else {
                console.warn('[MarketStructure] Markers plugin not initialized');
            }
        }
    }

    updateLastPoint(candle: Candle, candles: Candle[]) {
        // Redo the update logic with the newest candle
        this.update(candles, this.config);
    }

    destroy() {
        if (this.markersPlugin) {
            try {
                this.markersPlugin.detach();
            } catch (err) {
                console.warn('[MarketStructure] Failed to detach markers plugin:', err);
            }
            this.markersPlugin = null;
        }
        this.series = null;
    }
}
