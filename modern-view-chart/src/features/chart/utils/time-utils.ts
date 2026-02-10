
export function getCandleStartTime(timeMs: number, interval: string): number {
    const timeSec = Math.floor(timeMs / 1000);
    let intervalSec = 60;

    // Normalize interval string to seconds
    const lower = interval.toLowerCase();

    if (lower.endsWith('m')) {
        intervalSec = parseInt(lower) * 60;
    } else if (lower.endsWith('h')) {
        intervalSec = parseInt(lower) * 3600;
    } else if (lower.endsWith('d')) {
        intervalSec = parseInt(lower) * 86400;
    } else {
        // Assume minutes if number only unless specific mappings
        const val = parseInt(interval);
        // Common MT5 mappings: 1, 5, 15, 30 -> minutes
        // 60 -> 1h, 240 -> 4h, 1440 -> 1d
        if (!isNaN(val)) {
            if (val === 60) intervalSec = 3600;
            else if (val === 240) intervalSec = 14400; // 4h
            else if (val === 1440) intervalSec = 86400;
            else if (val < 16383) intervalSec = val * 60; // Default minute interpretation
        }
    }

    if (intervalSec <= 0) intervalSec = 60; // Fallback

    // Align to interval boundary
    const aligned = Math.floor(timeSec / intervalSec) * intervalSec;
    return aligned; // Return Seconds
}
