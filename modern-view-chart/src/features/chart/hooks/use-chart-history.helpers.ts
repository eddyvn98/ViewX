import { Time } from 'lightweight-charts';
import { normalizeSymbol } from '@/lib/utils/symbol';

const EMPTY_CANDLES: any[] = [];

export type CandleLookup = { key: string; candles: any[] };

export const parseIntervalSeconds = (interval: string): number => {
    const raw = String(interval || '').trim();
    if (!raw) return 60;
    if (/^\d+$/.test(raw)) return Number(raw) * 60;
    const m = raw.match(/^(\d+)\s*([mhd])$/i);
    if (!m) return 60;
    const value = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400;
    return 60;
};

export const buildIntervalCandidates = (interval: string | undefined): string[] => {
    const raw = String(interval || '').trim();
    if (!raw) return [];

    const out = new Set<string>([raw]);
    const lower = raw.toLowerCase();
    const m = lower.match(/^(\d+)m$/);
    if (m) out.add(m[1]);
    if (/^\d+$/.test(lower)) out.add(`${lower}m`);

    const mt5 = lower.match(/^m(\d+)$/);
    if (mt5) {
        out.add(mt5[1]);
        out.add(`${mt5[1]}m`);
    }

    return Array.from(out);
};

export const resolveCandles = (
    state: { candleData: Record<string, any[]> },
    source: string | undefined,
    normSymbol: string,
    intervalCandidates: string[]
): CandleLookup => {
    if (!source || !normSymbol || intervalCandidates.length === 0) {
        return { key: '', candles: EMPTY_CANDLES };
    }

    const exactSource = source.trim();
    const sourceVariants = Array.from(new Set([exactSource, exactSource.toUpperCase(), exactSource.toLowerCase()]));
    for (const src of sourceVariants) {
        for (const itv of intervalCandidates) {
            const key = `${src}:${normSymbol}:${itv}`;
            const arr = state.candleData[key];
            if (arr && arr.length > 0) {
                return { key, candles: arr };
            }
        }
    }

    const symbolLower = normSymbol.toLowerCase();
    const candidateSet = new Set(intervalCandidates.map((v) => String(v).toLowerCase()));
    for (const [k, arr] of Object.entries(state.candleData)) {
        if (!arr || arr.length === 0) continue;
        const parts = k.split(':');
        if (parts.length !== 3) continue;
        const [src, sym, itv] = parts;
        if (src.toLowerCase() !== exactSource.toLowerCase()) continue;
        if (sym.toLowerCase() !== symbolLower) continue;
        if (!candidateSet.has(itv.toLowerCase())) continue;
        return { key: k, candles: arr };
    }

    return { key: `${exactSource}:${normSymbol}:${intervalCandidates[0]}`, candles: EMPTY_CANDLES };
};

export const getNormalizedSymbol = (symbol: string | undefined) => normalizeSymbol(symbol);

export const updateSyncData = (
    formatted: any[],
    subRef: { current: { setData: (data: Array<{ time: Time; value: number }>) => void } | null },
    timeRef: { current: { setData: (data: Array<{ time: Time; value: number }>) => void } | null }
) => {
    const lastT = Number(formatted[formatted.length - 1].time);
    const timeStep = formatted.length > 1 ? lastT - Number(formatted[formatted.length - 2].time) : 60;
    const syncData = formatted
        .map((c) => ({ time: c.time, value: 0 }))
        .concat(Array.from({ length: 50 }, (_, i) => ({ time: (lastT + timeStep * (i + 1)) as Time, value: 0 })));
    subRef.current?.setData(syncData);
    timeRef.current?.setData(syncData);
};
