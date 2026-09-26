import { Time } from 'lightweight-charts';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { Candle } from '@/lib/store/types';

type ChartPoint = {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
};

const EMPTY_CANDLES: Candle[] = [];

export type CandleLookup = { key: string; candles: Candle[] };

export const parseIntervalSeconds = (interval: string): number => {
    const raw = String(interval || '').trim();
    if (!raw) return 60;
    const upper = raw.toUpperCase();

    if (upper === 'D' || upper === '1D') return 86400;
    if (upper === 'W' || upper === '1W') return 604800;
    if (upper === 'M' || upper === '1M' || upper === '1MO') return 2592000;
    if (upper === 'Y' || upper === '1Y') return 31536000;

    if (/^\d+$/.test(raw)) return Number(raw) * 60;

    const m = raw.match(/^(\d+)\s*([a-z]+)$/i);
    if (!m) return 60;
    const value = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400;
    if (unit === 'w') return value * 604800;
    if (unit === 'mo' || unit === 'mn') return value * 2592000;
    if (unit === 'y') return value * 31536000;
    return 60;
};

export const buildIntervalCandidates = (interval: string | undefined): string[] => {
    const raw = String(interval || '').trim();
    if (!raw) return [];

    const out = new Set<string>([raw]);
    const upper = raw.toUpperCase();

    if (upper === '1440' || upper === '1D' || upper === 'D') {
        out.add('1440');
        out.add('1440m');
        out.add('1D');
        out.add('D');
        out.add('1d');
        out.add('d1');
    } else if (upper === '10080' || upper === '1W' || upper === 'W') {
        out.add('10080');
        out.add('10080m');
        out.add('1W');
        out.add('W');
        out.add('1w');
        out.add('w1');
    } else if (upper === '43200' || upper === '1M' || upper === 'M' || upper === '1MO') {
        out.add('43200');
        out.add('43200m');
        out.add('1M');
        out.add('M');
        out.add('1mo');
        out.add('mn1');
    } else if (upper === '525600' || upper === '1Y' || upper === 'Y') {
        out.add('525600');
        out.add('525600m');
        out.add('1Y');
        out.add('Y');
        out.add('1y');
        out.add('y1');
    }

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
    state: { candleData: Record<string, Candle[]> },
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
    formatted: ChartPoint[],
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
