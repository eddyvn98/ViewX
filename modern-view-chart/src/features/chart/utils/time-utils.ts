type TimeInput =
    | number
    | string
    | { timestamp?: number | string }
    | { year: number; month: number; day: number }
    | null
    | undefined;

export const toSec = (t: TimeInput): number => {
    if (typeof t === 'object' && t !== null && 'year' in t && 'month' in t && 'day' in t) {
        return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
    }
    const raw = typeof t === 'object' && t !== null ? t.timestamp : t;
    const n = Number(raw);
    if (Number.isFinite(n)) {
        return n > 10000000000 ? Math.floor(n / 1000) : n;
    }
    if (typeof raw === 'string') {
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
    }
    return NaN;
};
