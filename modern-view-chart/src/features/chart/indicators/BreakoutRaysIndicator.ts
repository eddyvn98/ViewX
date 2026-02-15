import { ISeriesApi } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateDynamicSwingPoints } from '../logic/candle-patterns';
import { toSec } from '../utils/time-utils';

export class BreakoutRaysIndicator {
    private rayHH: any = null;
    private rayLL: any = null;
    private lastHHPrice: number | undefined;
    private lastLLPrice: number | undefined;

    constructor(
        private series: ISeriesApi<any>,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;
        if (!this.series) return;

        if (!this.config.visible) {
            this.clearRays();
            return;
        }

        const formattedData = candles.map(c => ({
            ...c,
            time: toSec(c.time) as any
        }));

        const markers = calculateDynamicSwingPoints(formattedData, 7);

        let hh: number | undefined;
        let ll: number | undefined;

        for (let i = markers.length - 1; i >= 0; i--) {
            const m = markers[i] as any;
            if (!hh && m.markerType === 'high') hh = m.price;
            if (!ll && m.markerType === 'low') ll = m.price;
            if (hh && ll) break;
        }

        this.setPrices(hh, ll);
    }

    // This indicator is better updated via identified prices
    setPrices(hh: number | undefined, ll: number | undefined) {
        if (!this.series || !this.config.visible) return;

        if (hh !== this.lastHHPrice) {
            if (this.rayHH && typeof this.series.removePriceLine === 'function') {
                this.series.removePriceLine(this.rayHH);
            }
            if (hh && typeof this.series.createPriceLine === 'function') {
                this.rayHH = this.series.createPriceLine({
                    price: hh,
                    color: '#ef5350',
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    axisLabelVisible: false,
                });
            }
            this.lastHHPrice = hh;
        }

        if (ll !== this.lastLLPrice) {
            if (this.rayLL && typeof this.series.removePriceLine === 'function') {
                this.series.removePriceLine(this.rayLL);
            }
            if (ll && typeof this.series.createPriceLine === 'function') {
                this.rayLL = this.series.createPriceLine({
                    price: ll,
                    color: '#26a69a',
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    axisLabelVisible: false,
                });
            }
            this.lastLLPrice = ll;
        }
    }

    private clearRays() {
        if (this.rayHH && this.series && typeof this.series.removePriceLine === 'function') {
            this.series.removePriceLine(this.rayHH);
        }
        if (this.rayLL && this.series && typeof this.series.removePriceLine === 'function') {
            this.series.removePriceLine(this.rayLL);
        }
        this.rayHH = null;
        this.rayLL = null;
        this.lastHHPrice = undefined;
        this.lastLLPrice = undefined;
    }

    destroy() {
        this.clearRays();
        this.series = null as any;
    }
}
