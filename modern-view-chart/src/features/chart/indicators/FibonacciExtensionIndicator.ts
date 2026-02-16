
import { ISeriesApi, Time } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateDynamicSwingPoints } from '../logic/candle-patterns';
import { toSec } from '../utils/time-utils';
import { FibonacciExtensionPrimitive, FibonacciExtensionData } from '../logic/fibonacci-extension-primitive';

export class FibonacciExtensionIndicator {
    private primitive: FibonacciExtensionPrimitive | null = null;
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

        // 1. Calculate Swing Points
        const markers = calculateDynamicSwingPoints(formattedData, this.config.params.depth || 7);
        if (markers.length < 3) {
            console.warn('[Fibonacci Extension] Not enough swing points:', markers.length);
            this.clear();
            return;
        }

        // 2. Find the 3 most recent points (P1, P2, P3)
        // P1: Start of trend, P2: End of trend move, P3: Retracement point
        const recentMarkers = markers.slice(-3).sort((a: any, b: any) => (a.time as number) - (b.time as number));
        const [p1, p2, p3] = recentMarkers as any[];

        const p1Price = p1.price;
        const p2Price = p2.price;
        const p3Price = p3.price;
        const moveRange = p2Price - p1Price;

        const levelSettings = this.config.params.levels || {};
        const showPercent = this.config.params.showPercent !== false;
        const showPrice = this.config.params.showPrice !== false;

        const defaultLevels = [
            { ratio: 0, label: '0%', color: '#ff3366' },
            { ratio: 0.236, label: '23.6%', color: '#ff9800' },
            { ratio: 0.382, label: '38.2%', color: '#4caf50' },
            { ratio: 0.5, label: '50%', color: '#2196f3' },
            { ratio: 0.618, label: '61.8%', color: '#4caf50' },
            { ratio: 0.786, label: '78.6%', color: '#9c27b0' },
            { ratio: 1.0, label: '100%', color: '#00ff88' },
            { ratio: 1.618, label: '161.8%', color: '#ff3366' },
            { ratio: 2.618, label: '261.8%', color: '#ff3366' },
        ];

        const fibData: FibonacciExtensionData = {
            p1Time: p1.time,
            p2Time: p2.time,
            p3Time: p3.time,
            p1Price,
            p2Price,
            p3Price,
            showPercent,
            showPrice,
            levels: defaultLevels
                .filter(l => levelSettings[l.ratio.toString()] !== false)
                .map(l => ({
                    ...l,
                    price: p3Price + moveRange * l.ratio
                }))
        };

        // 3. Update Primitive
        const dataJson = JSON.stringify(fibData);
        if (dataJson !== this.lastDataJson) {
            if (!this.primitive) {
                this.primitive = new FibonacciExtensionPrimitive(fibData);
                this.series.attachPrimitive(this.primitive);
                console.log('[Fibonacci Extension] Attached primitive');
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
