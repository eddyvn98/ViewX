
import { Time } from 'lightweight-charts';

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236];

export function calculateFibLevels(
    type: string,
    points: { time: Time | number; price: number }[],
    params?: any,
    defaultColor: string = '#2962FF'
) {
    if (points.length < 2) return [];

    const p1 = points[0];
    const p2 = points[1];
    const diff = p2.price - p1.price;
    const levels: { price: number; ratio: number; color: string; label: string }[] = [];

    const enabledLevels = params?.enabledLevels || {
        "0": true, "1": true, "0.5": true, "0.618": true, "0.382": true
    };

    FIB_LEVELS.forEach(level => {
        // Check if level is enabled (default to true if not specified in params for standard levels)
        if (enabledLevels[level.toString()] === false) return;

        // For extended fibs or if specifically enabled
        if (!enabledLevels[level.toString()] && level > 1) return;

        levels.push({
            price: p1.price + diff * level,
            ratio: level,
            color: defaultColor,
            label: `${level}`
        });
    });

    return levels;
}
