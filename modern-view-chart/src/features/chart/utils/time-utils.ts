export const toSec = (t: any): number => {
    const raw = typeof t === 'object' ? (t as any)?.timestamp : t;
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
