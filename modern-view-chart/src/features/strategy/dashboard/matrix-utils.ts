import { normalizeSymbol } from '@/lib/utils/symbol';
import { normalizeTF } from '../utils/time-utils';
import type { MatrixScannerConfig, MatrixSortMode } from './matrix-types';

const TIMEFRAME_RE = /^(\d+)(m|h|d|w|mo)$/i;

export function normalizeDashboardTf(tf: string | undefined): string {
    const norm = normalizeTF(tf || '');
    if (!norm) return '';
    if (norm === '1w') return '1w';
    if (norm === '1mo' || norm === '1m0') return '1mo';
    return norm;
}

export function timeframeToSeconds(tf: string | undefined): number {
    const norm = normalizeDashboardTf(tf);
    const match = norm.match(TIMEFRAME_RE);
    if (!match) return 0;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400;
    if (unit === 'w') return value * 7 * 86400;
    if (unit === 'mo') return value * 30 * 86400;
    return 0;
}

export function compareTimeframe(a: string, b: string): number {
    const diff = timeframeToSeconds(a) - timeframeToSeconds(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
}

export function normalizeDashboardSymbol(symbol: string | undefined): string {
    const normalized = normalizeSymbol(symbol || '').trim();
    return normalized;
}

export function sortSymbols(symbols: string[], mode: MatrixSortMode): string[] {
    const deduped = Array.from(new Set(symbols.map((s) => normalizeDashboardSymbol(s)).filter(Boolean)));
    if (mode === 'abc') {
        return [...deduped].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    return deduped;
}

export function resolveCellTTL(tf: string, config: Pick<MatrixScannerConfig, 'signalTtlMultiplier' | 'signalTtlFloorSec'>): number {
    const tfSec = timeframeToSeconds(tf);
    const byTf = tfSec > 0 ? tfSec * Math.max(1, config.signalTtlMultiplier || 1) : 0;
    return Math.max(Math.max(1, config.signalTtlFloorSec || 60), byTf);
}

export function timeframeToChartInterval(tf: string): string {
    const norm = normalizeDashboardTf(tf);
    if (!norm) return '1';
    const m = norm.match(/^(\d+)m$/i);
    if (m) return m[1];
    const h = norm.match(/^(\d+)h$/i);
    if (h) return String(Number(h[1]) * 60);
    const d = norm.match(/^(\d+)d$/i);
    if (d) return String(Number(d[1]) * 1440);
    const w = norm.match(/^(\d+)w$/i);
    if (w) return String(Number(w[1]) * 10080);
    const mo = norm.match(/^(\d+)mo$/i);
    if (mo) return String(Number(mo[1]) * 43200);
    return norm;
}

export function chartIntervalToDashboardTf(interval: string): string {
    return normalizeDashboardTf(interval);
}
