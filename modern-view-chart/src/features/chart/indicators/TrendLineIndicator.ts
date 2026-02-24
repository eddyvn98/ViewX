
import { ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';

type TrendMarker = SeriesMarker<Time> & {
    price: number;
    markerType: 'high' | 'low';
};
import { calculateDynamicSwingPoints } from '../logic/candle-patterns';
import { toSec } from '../utils/time-utils';
import { TrendLinePrimitive, TrendLineData } from '../logic/trend-line-primitive';

export class TrendLineIndicator {
    private primitive: TrendLinePrimitive | null = null;
    private lastCandleCount: number = 0;

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
        const supportColor = styles.support || '#00ff88';
        const resistanceColor = styles.resistance || '#ff3366';
        const lineWidth = styles.width || 2;

        // 1. Use EXACTLY the same depth as Market Structure to match markers
        const markers = calculateDynamicSwingPoints(formattedData, 7, supportColor, resistanceColor);

        const lines: TrendLineData[] = [];

        const highs = markers.filter(m => (m as any).markerType === 'high') as unknown as TrendMarker[];
        const lows = markers.filter(m => (m as any).markerType === 'low') as unknown as TrendMarker[];

        // Logic: Connect LAST 2 points.
        // VALIDATION: Check if line is BROKEN by subsequent price action (Close > Line for Resistance, Close < Line for Support).

        // Draw Resistance Line (Highs)
        if (highs.length >= 2) {
            const p2 = highs[highs.length - 1]; // Last point
            const p1 = highs[highs.length - 2]; // Previous point

            // Filter: Only draw if descending (Lower High)
            if (p1 && p2 && p1.time !== p2.time && p2.price < p1.price) {
                // Find indices for slope calculation
                const p1Idx = formattedData.findIndex(d => d.time === p1.time);
                const p2Idx = formattedData.findIndex(d => d.time === p2.time);

                if (p1Idx !== -1 && p2Idx !== -1) {
                    const slope = (p2.price - p1.price) / (p2Idx - p1Idx);
                    let isBroken = false;

                    // Check if BROKEN by any candle AFTER P2
                    for (let k = p2Idx + 1; k < formattedData.length; k++) {
                        const candle = formattedData[k];
                        const projected = p2.price + slope * (k - p2Idx);

                        // Resistance Logic: If Close > Line -> BROKEN -> Don't Draw
                        if (candle.close > projected) {
                            isBroken = true;
                            break;
                        }
                    }

                    if (!isBroken) {
                        lines.push({
                            p1: { time: p1.time, price: p1.price },
                            p2: { time: p2.time, price: p2.price },
                            color: resistanceColor,
                            width: lineWidth,
                            style: 2, // Dashed
                            extendRight: true
                        });
                    }
                }
            }
        }

        // Draw Support Line (Lows)
        if (lows.length >= 2) {
            const p2 = lows[lows.length - 1];
            const p1 = lows[lows.length - 2];

            // Filter: Only draw if ascending (Higher Low)
            if (p1 && p2 && p1.time !== p2.time && p2.price > p1.price) {
                const p1Idx = formattedData.findIndex(d => d.time === p1.time);
                const p2Idx = formattedData.findIndex(d => d.time === p2.time);

                if (p1Idx !== -1 && p2Idx !== -1) {
                    const slope = (p2.price - p1.price) / (p2Idx - p1Idx);
                    let isBroken = false;

                    // Check if BROKEN by any candle AFTER P2
                    for (let k = p2Idx + 1; k < formattedData.length; k++) {
                        const candle = formattedData[k];
                        const projected = p2.price + slope * (k - p2Idx);

                        // Support Logic: If Close < Line -> BROKEN -> Don't Draw
                        if (candle.close < projected) {
                            isBroken = true;
                            break;
                        }
                    }

                    if (!isBroken) {
                        lines.push({
                            p1: { time: (p1 as any).time, price: (p1 as any).price },
                            p2: { time: (p2 as any).time, price: (p2 as any).price },
                            color: supportColor,
                            width: lineWidth,
                            style: 2, // Dashed
                            extendRight: true
                        });
                    }
                }
            }
        }

        if (!this.primitive) {
            this.primitive = new TrendLinePrimitive(lines);
            this.series.attachPrimitive(this.primitive);
        } else {
            this.primitive.setData(lines);
        }
    }

    clear() {
        if (this.primitive) {
            this.series.detachPrimitive(this.primitive);
            this.primitive = null;
        }
    }

    destroy() {
        this.clear();
        this.series = null as any;
    }
}
