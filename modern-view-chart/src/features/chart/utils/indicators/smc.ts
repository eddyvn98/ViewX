import { Candle } from '@/lib/store/types';

export interface FVGData {
    time: number;
    top: number;
    bottom: number;
    type: 'bullish' | 'bearish';
}

export interface OrderBlockData {
    time: number;
    high: number;
    low: number;
    type: 'bullish' | 'bearish';
    isMitigated: boolean;
    mitigationTime?: number;
}

/**
 * Calculates Fair Value Gaps (FVG)
 */
export function calculateFVG(candles: Candle[]): FVGData[] {
    const fvgs: FVGData[] = [];
    if (candles.length < 3) return fvgs;

    for (let i = 1; i < candles.length - 1; i++) {
        const prev = candles[i - 1];
        const next = candles[i + 1];

        // Bullish FVG: Low of candle i+1 is higher than High of candle i-1
        if (Number(next.low) > Number(prev.high)) {
            fvgs.push({
                time: typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time),
                top: Number(next.low),
                bottom: Number(prev.high),
                type: 'bullish'
            });
        }
        // Bearish FVG: High of candle i+1 is lower than Low of candle i-1
        else if (Number(next.high) < Number(prev.low)) {
            fvgs.push({
                time: typeof candles[i].time === 'object' ? (candles[i].time as any).timestamp : Number(candles[i].time),
                top: Number(prev.low),
                bottom: Number(next.high),
                type: 'bearish'
            });
        }
    }

    return fvgs;
}

/**
 * Calculates Order Blocks (OB) based on BOS (Break of Structure)
 */
export function calculateOrderBlocks(candles: Candle[], depth: number = 5): OrderBlockData[] {
    const obs: OrderBlockData[] = [];
    if (candles.length < depth * 2) return obs;

    // Simple swing detection for BOS
    let lastHigh = -Infinity;
    let lastLow = Infinity;
    let lastBearishCandle: Candle | null = null;
    let lastBullishCandle: Candle | null = null;

    for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const prev = candles[i - 1];
        const close = Number(c.close);
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);

        // Track last candles of opposite color
        if (close < open) {
            lastBearishCandle = c;
        } else if (close > open) {
            lastBullishCandle = c;
        }

        // Detect BOS (Break of Structure)
        // This is a simplified version. A real one would use confirmed swing points.

        // Bullish BOS (Close above previous local high)
        if (close > lastHigh && lastHigh !== -Infinity) {
            if (lastBearishCandle) {
                obs.push({
                    time: typeof lastBearishCandle.time === 'object' ? (lastBearishCandle.time as any).timestamp : Number(lastBearishCandle.time),
                    high: Number(lastBearishCandle.high),
                    low: Number(lastBearishCandle.low),
                    type: 'bullish',
                    isMitigated: false
                });
            }
        }

        // Bearish BOS (Close below previous local low)
        if (close < lastLow && lastLow !== Infinity) {
            if (lastBullishCandle) {
                obs.push({
                    time: typeof lastBullishCandle.time === 'object' ? (lastBullishCandle.time as any).timestamp : Number(lastBullishCandle.time),
                    high: Number(lastBullishCandle.high),
                    low: Number(lastBullishCandle.low),
                    type: 'bearish',
                    isMitigated: false
                });
            }
        }

        // Update local highs/lows for next detection
        // Using a basic window approach
        if (i >= depth) {
            let windowHigh = -Infinity;
            let windowLow = Infinity;
            for (let j = i - depth; j <= i; j++) {
                windowHigh = Math.max(windowHigh, Number(candles[j].high));
                windowLow = Math.min(windowLow, Number(candles[j].low));
            }
            lastHigh = windowHigh;
            lastLow = windowLow;
        }

        // Mitigation check for existing OBs
        obs.forEach(ob => {
            if (!ob.isMitigated) {
                if (ob.type === 'bullish' && low <= ob.high) {
                    ob.isMitigated = true;
                    ob.mitigationTime = typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time);
                } else if (ob.type === 'bearish' && high >= ob.low) {
                    ob.isMitigated = true;
                    ob.mitigationTime = typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time);
                }
            }
        });
    }

    // Return only recent 10-20 OBs to avoid cluttering and performance issues
    return obs.slice(-20);
}
