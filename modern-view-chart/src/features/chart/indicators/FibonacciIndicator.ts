
import { ISeriesApi, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateDynamicSwingPoints } from '../logic/candle-patterns';
import { toSec } from '../utils/time-utils';
import { FibonacciPrimitive, FibonacciData } from '../logic/fibonacci-primitive';

type SwingPoint = { time: Time; price: number; markerType: 'high' | 'low' };

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
            time: toSec(c.time) as Time
        }));

        const globalLineColor = typeof this.config.styles?.lineColor === 'string' ? this.config.styles.lineColor : '#ffffff';
        const globalLabelColor = typeof this.config.styles?.labelColor === 'string' ? this.config.styles.labelColor : '#ffffff';
        const bgOpacity = typeof this.config.styles?.opacity === 'number' ? this.config.styles.opacity : 0.1;

        // 1. Calculate Swing Points (consistent depth)
        const depthValue = this.config.params.depth;
        const depth = typeof depthValue === 'number' && Number.isFinite(depthValue) ? depthValue : 7;
        const markers = calculateDynamicSwingPoints(formattedData, depth, '#00ff88', '#ff3366') as unknown as SwingPoint[];
        if (markers.length < 2) {
            console.warn('[Fibonacci] Not enough swing points:', markers.length);
            this.clear();
            return;
        }

        // 2. Find the most recent High and Low
        let lastHigh: SwingPoint | null = null;
        let lastLow: SwingPoint | null = null;

        for (let i = markers.length - 1; i >= 0; i--) {
            const m = markers[i];
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
        let p1: SwingPoint;
        let p2: SwingPoint;
        if (Number(lastHigh.time) < Number(lastLow.time)) {
            p1 = lastHigh;
            p2 = lastLow;
        } else {
            p1 = lastLow;
            p2 = lastHigh;
        }

        const p1Price = p1.price;
        const p2Price = p2.price;
        const diff = p2Price - p1Price;

        const rawLevels = this.config.params.levels;
        const levelSettings: Record<string, boolean> =
            rawLevels && typeof rawLevels === 'object' ? (rawLevels as Record<string, boolean>) : {};
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
