import type { DataSource } from './market-list-constants';

let cachedBinanceUniverse: string[] | null = null;
let pendingBinanceUniverseRequest: Promise<string[]> | null = null;

type BinanceExchangeSymbol = { symbol?: string; status?: string };
type BinanceExchangeInfo = { symbols?: BinanceExchangeSymbol[] };

export function resolveDataSource(symbol: string): DataSource {
    const normalized = String(symbol || '').toUpperCase();
    if (normalized === 'SJCVN' || normalized === 'DOJIVN') return 'VN_GOLD';
    return normalized.includes('USDT') ? 'BINANCE' : 'MT5';
}

export async function fetchBinanceUniverse(): Promise<string[]> {
    if (cachedBinanceUniverse) return cachedBinanceUniverse;
    if (pendingBinanceUniverseRequest) return pendingBinanceUniverseRequest;

    pendingBinanceUniverseRequest = (async () => {
        const res = await fetch('/api/user/symbols', { cache: 'no-store' });
        if (!res.ok) return [];

        const data = (await res.json()) as string[] | BinanceExchangeInfo;
        const symbols = Array.isArray(data)
            ? data.filter((symbol) => String(symbol || '').endsWith('USDT'))
            : Array.isArray(data?.symbols)
                ? data.symbols
                    .filter((s) => s?.status === 'TRADING' && String(s?.symbol || '').endsWith('USDT'))
                    .map((s) => String(s.symbol))
                : [];

        cachedBinanceUniverse = Array.from(new Set(symbols));
        return cachedBinanceUniverse;
    })();

    try {
        return await pendingBinanceUniverseRequest;
    } finally {
        pendingBinanceUniverseRequest = null;
    }
}
