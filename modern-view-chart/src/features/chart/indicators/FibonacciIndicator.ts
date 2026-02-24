
import { ISeriesApi, SeriesMarker, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateDynamicSwingPoints } from '../logic/candle-patterns';
import { toSec } from '../utils/time-utils';
import { FibonacciPrimitive, FibonacciData } from '../logic/fibonacci-primitive';

export class FibonacciIndicator {
    private primitive: FibonacciPrimitive | null = null;
    private lastDataJson: string = '';

    constructor(
        private series: ISeriesApi<any>,
        private config: IndicatorConfig
    ) { }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;
        if (!this.series) return;

        if (!this.config.visible) {
            this.clear();
            return;
        }

        const formattedData = candles.map(c => ({
            ...c,
            time: toSec(c.time) as any
        }));

        const styles = this.config.styles || {};
        const globalLineColor = styles.lineColor || '#ffffff';
        const globalLabelColor = styles.labelColor || '#ffffff';
        const bgOpacity = styles.opacity ?? 0.1;

        // 1. Calculate Swing Points (consistent depth)
        const markers = calculateDynamicSwingPoints(formattedData, this.config.params.depth || 7, '#00ff88', '#ff3366');
        if (markers.length < 2) {
            console.warn('[Fibonacci] Not enough swing points:', markers.length);
            this.clear();
            return;
        }

        // 2. Find the most recent High and Low
        let lastHigh: any = null;
        let lastLow: any = null;

        for (let i = markers.length - 1; i >= 0; i--) {
            const m = markers[i] as any;
            if (!lastHigh && m.markerType === 'high') lastHigh = m;
            if (!lastLow && m.markerType === 'low') lastLow = m;
            if (lastHigh && lastLow) break;
        }

        if (!lastHigh || !lastLow) {
            console.warn('[Fibonacci] Could not find both High and Low swings');
            this.clear();
            return;
        }

        // 3. Prepare Fibonacci Data
        let p1, p2;
        if ((lastHigh as any).time < (lastLow as any).time) {
            p1 = lastHigh;
            p2 = lastLow;
        } else {
            p1 = lastLow;
            p2 = lastHigh;
        }

        const p1Price = (p1 as any).price;
        const p2Price = (p2 as any).price;
        const diff = p2Price - p1Price;

        const levelSettings = this.config.params.levels || {};
        const showPercent = this.config.params.showPercent !== false;
        const showPrice = this.config.params.showPrice !== false;

        const allLevels = [
            { ratio: 0, label: '0%', color: '#ff3366' },
            { ratio: 0.236, label: '23.6%', color: globalLineColor === '#ffffff' ? '#ff9800' : globalLineColor },
            { ratio: 0.382, label: '38.2%', color: globalLineColor === '#ffffff' ? '#4caf50' : globalLineColor },
            { ratio: 0.5, label: '50%', color: globalLineColor === '#ffffff' ? '#2196f3' : globalLineColor },
            { ratio: 0.618, label: '61.8%', color: globalLineColor === '#ffffff' ? '#4caf50' : globalLineColor },
            { ratio: 0.786, label: '78.6%', color: globalLineColor === '#ffffff' ? '#9c27b0' : globalLineColor },
            { ratio: 1.0, label: '100%', color: '#00ff88' },
        ];

        const fibData: FibonacciData = {
            startTime: p1.time,
            endTime: p2.time,
            showPercent,
            showPrice,
            lineColor: globalLineColor,
            labelColor: globalLabelColor,
            backgroundOpacity: bgOpacity,
            levels: allLevels
                .filter(l => levelSettings[l.ratio.toString()] !== false)
                .map(l => ({
                    ...l,
                    price: p2Price - diff * l.ratio
                }))
        };

        // 4. Update Primitive
        const dataJson = JSON.stringify(fibData);
        if (dataJson !== this.lastDataJson) {
            console.log('[Fibonacci] Updating with data:', fibData);
            if (!this.primitive) {
                this.primitive = new FibonacciPrimitive(fibData);
                this.series.attachPrimitive(this.primitive);
                console.log('[Fibonacci] Attached primitive');
            } else {
                this.primitive.setData(fibData);
            }
            this.lastDataJson = dataJson;
        }
    }

    clear() {
        if (this.primitive) {
            this.series.detachPrimitive(this.primitive);
            this.primitive = null;
            this.lastDataJson = '';
        }
    }

    destroy() {
        this.clear();
    }
}
