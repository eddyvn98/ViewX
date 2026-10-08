import type { Candle } from '@/lib/store/types';

const BINANCE_HTTP_TIMEOUT_MS = 4500;

type BinanceHistoryResponse = {
    candles?: unknown;
};

function normalizeCandle(row: unknown): Candle | null {
    if (!row || typeof row !== 'object') return null;
    const value = row as Record<string, unknown>;
    const time = Number(value.time);
    const open = Number(value.open);
    const high = Number(value.high);
    const low = Number(value.low);
    const close = Number(value.close);
    const volume = Number(value.volume ?? 0);

    if (![time, open, high, low, close, volume].every(Number.isFinite)) return null;
    return { time, open, high, low, close, volume } as Candle;
}

export function parseBinanceHistoryResponse(payload: unknown): Candle[] {
    const rows = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as BinanceHistoryResponse | null)?.candles)
            ? (payload as BinanceHistoryResponse).candles as unknown[]
            : [];

    return rows
        .map(normalizeCandle)
        .filter((candle): candle is Candle => candle !== null);
}

export async function fetchBinanceHistoryHttp(
    symbol: string,
    interval: string,
    limit = 500,
    externalSignal?: AbortSignal,
): Promise<Candle[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BINANCE_HTTP_TIMEOUT_MS);
    const abortFromExternal = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

    try {
        const response = await fetch('/api/chart/data', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ symbol, interval, limit }),
            signal: controller.signal,
            cache: 'no-store',
        });

        if (!response.ok) return [];
        return parseBinanceHistoryResponse(await response.json().catch(() => null));
    } catch {
        return [];
    } finally {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', abortFromExternal);
    }
}
