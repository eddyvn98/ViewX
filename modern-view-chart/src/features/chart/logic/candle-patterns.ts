import { SeriesMarker, Time } from 'lightweight-charts';

export interface CandleData {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
}

/**
 * Calculates ZigZag Swing Points and Market Structure (HH, HL, LH, LL)
 * depth: minimum candles between swing points
 */
export function calculateSwingPoints(
    data: CandleData[],
    depth: number = 7,
    bullColor: string = '#00ff88',
    bearColor: string = '#ff3366'
): SeriesMarker<Time>[] {
    if (data.length < depth * 2) return [];

    const markers: SeriesMarker<Time>[] = [];
    let lastSwing: { type: 'high' | 'low'; price: number; index: number; time: Time } | null = null;
    let prevHigh: number | null = null;
    let prevLow: number | null = null;

    const findHighInRange = (start: number, end: number) => {
        let high = data[start].high;
        let index = start;
        for (let i = start + 1; i <= end; i++) {
            if (data[i].high > high) {
                high = data[i].high;
                index = i;
            }
        }
        return { high, index };
    };

    const findLowInRange = (start: number, end: number) => {
        let low = data[start].low;
        let index = start;
        for (let i = start + 1; i <= end; i++) {
            if (data[i].low < low) {
                low = data[i].low;
                index = i;
            }
        }
        return { low, index };
    };

    // First, find ZigZag points
    const zigZagPoints: { type: 'high' | 'low'; price: number; index: number; time: Time }[] = [];

    for (let i = depth; i < data.length - depth; i++) {
        const { high, index: hIdx } = findHighInRange(i - depth, i + depth);
        if (hIdx === i) {
            if (!lastSwing || (lastSwing.type === 'low' && high > lastSwing.price) || (lastSwing.type === 'high' && high > lastSwing.price)) {
                if (lastSwing?.type === 'high') {
                    // If we find a higher high before a low, update the last high
                    const point: { type: 'high' | 'low'; price: number; index: number; time: Time } = { type: 'high', price: high, index: i, time: data[i].time };
                    zigZagPoints[zigZagPoints.length - 1] = point;
                    lastSwing = point;
                } else {
                    const point: { type: 'high' | 'low'; price: number; index: number; time: Time } = { type: 'high', price: high, index: i, time: data[i].time };
                    zigZagPoints.push(point);
                    lastSwing = point;
                }
            }
        }

        const { low, index: lIdx } = findLowInRange(i - depth, i + depth);
        if (lIdx === i) {
            if (!lastSwing || (lastSwing.type === 'high' && low < lastSwing.price) || (lastSwing.type === 'low' && low < lastSwing.price)) {
                if (lastSwing?.type === 'low') {
                    // If we find a lower low before a high, update the last low
                    const point: { type: 'high' | 'low'; price: number; index: number; time: Time } = { type: 'low', price: low, index: i, time: data[i].time };
                    zigZagPoints[zigZagPoints.length - 1] = point;
                    lastSwing = point;
                } else {
                    const point: { type: 'high' | 'low'; price: number; index: number; time: Time } = { type: 'low', price: low, index: i, time: data[i].time };
                    zigZagPoints.push(point);
                    lastSwing = point;
                }
            }
        }
    }

    // Assign labels based on previous peaks/troughs
    for (let i = 0; i < zigZagPoints.length; i++) {
        const current = zigZagPoints[i];
        let label = '';
        let color = '';

        if (current.type === 'high') {
            if (prevHigh === null) {
                label = 'H';
            } else if (current.price > prevHigh) {
                label = 'HH';
            } else {
                label = 'LH';
            }
            prevHigh = current.price;
            color = bearColor; // Bearish Peak (High)
        } else {
            if (prevLow === null) {
                label = 'L';
            } else if (current.price < prevLow) {
                label = 'LL';
            } else {
                label = 'HL';
            }
            prevLow = current.price;
            color = bullColor; // Bullish Trough (Low)
        }

        markers.push({
            time: current.time,
            position: current.type === 'high' ? 'aboveBar' : 'belowBar',
            color: color,
            shape: 'circle',
            text: current.price.toString(),
            size: 0,
            price: current.price as any,
            markerType: current.type
        } as any);
    }

    return markers;
}

/**
 * Calculates Dynamic Swing Points that identify "tentative" highs/lows at the chart's edge.
 */
export function calculateDynamicSwingPoints(
    data: CandleData[],
    depth: number = 5,
    bullColor: string = '#00ff88',
    bearColor: string = '#ff3366'
): SeriesMarker<Time>[] {
    if (data.length < depth * 2) return [];

    // 1. Get confirmed points using standard logic
    const markers = calculateSwingPoints(data, depth, bullColor, bearColor);

    // 2. Identify the last confirmed high and low price to compare HH/LL
    let lastHighPrice = -Infinity;
    let lastLowPrice = Infinity;
    let lastConfirmedIndex = 0;

    markers.forEach(m => {
        const idx = data.findIndex(d => d.time === m.time);
        if (idx > lastConfirmedIndex) lastConfirmedIndex = idx;

        const price = m.position === 'aboveBar' ? (data[idx]?.high || 0) : (data[idx]?.low || 0);
        if (m.position === 'aboveBar') lastHighPrice = price;
        else lastLowPrice = price;
    });

    // 3. Look for "Tentative" points in the trailing candles (after lastConfirmedIndex)
    const trailingData = data.slice(lastConfirmedIndex + 1);
    if (trailingData.length === 0) return markers;

    let tentativeHigh = -Infinity;
    let tentativeHighIdx = -1;
    let tentativeLow = Infinity;
    let tentativeLowIdx = -1;

    trailingData.forEach((d, i) => {
        if (d.high > tentativeHigh) {
            tentativeHigh = d.high;
            tentativeHighIdx = i + lastConfirmedIndex + 1;
        }
        if (d.low < tentativeLow) {
            tentativeLow = d.low;
            tentativeLowIdx = i + lastConfirmedIndex + 1;
        }
    });

    // 4. Add Tentative High if it's significant (higher than last few candles)
    if (tentativeHighIdx !== -1) {
        markers.push({
            time: data[tentativeHighIdx].time,
            position: 'aboveBar',
            color: bearColor,
            shape: 'circle',
            text: tentativeHigh.toString(),
            size: 0,
            isTentative: true,
            price: tentativeHigh, // Keep track of price
            markerType: 'high'
        } as any);
    }

    // 5. Add Tentative Low if it's significant
    if (tentativeLowIdx !== -1) {
        markers.push({
            time: data[tentativeLowIdx].time,
            position: 'belowBar',
            color: bullColor,
            shape: 'circle',
            text: tentativeLow.toString(),
            size: 0,
            isTentative: true,
            price: tentativeLow, // Keep track of price
            markerType: 'low'
        } as any);
    }

    return markers;
}
