export const toSec = (t: any): number => {
    const n = typeof t === 'object' ? (t as any).timestamp : Number(t);
    return n > 10000000000 ? Math.floor(n / 1000) : n;
};
