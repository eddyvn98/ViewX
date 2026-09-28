import type { MarketDataSource, SymbolDescriptor } from '@/lib/store/types';
import { normalizeSymbol } from '@/lib/utils/symbol';

function optionalText(value: unknown): string | null {
    const text = String(value || '').trim();
    return text || null;
}

export function buildSymbolIdentityKey(item: Pick<SymbolDescriptor, 'symbol' | 'source' | 'accountLogin' | 'terminalId'>): string {
    return [
        item.source,
        item.accountLogin || '',
        item.terminalId || '',
        item.symbol,
    ].join('|');
}

export function getSymbolSearchKey(symbol: string): string {
    return String(symbol || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

export function getSymbolDisplayBase(symbol: string): string {
    const raw = String(symbol || '').trim();
    if (!raw) return '';
    return raw
        .replace(/^[^A-Za-z0-9]+/, '')
        .replace(/[._-]?(pro|raw|ecn|mini|micro)$/i, '')
        .replace(/[._-]?m$/i, '');
}

export function normalizeTransportSymbol(symbol: string, source: MarketDataSource): string {
    const raw = String(symbol || '').trim();
    if (!raw) return '';
    if (source === 'MT5' || source === 'MT5_PERSONAL') return raw;
    return normalizeSymbol(raw);
}

export function createSymbolDescriptor(
    item: unknown,
    context: {
        source: MarketDataSource;
        accountLogin?: string | null;
        terminalId?: string | null;
        broker?: string | null;
    },
): SymbolDescriptor | null {
    const raw = item && typeof item === 'object'
        ? item as Record<string, unknown>
        : { symbol: item };
    const symbol = String(raw.symbol || '').trim();
    if (!symbol) return null;

    const digitsRaw = Number(raw.digits);
    return {
        symbol,
        source: context.source,
        accountLogin: optionalText(raw.account_login ?? raw.accountLogin ?? context.accountLogin),
        terminalId: optionalText(raw.terminal_id ?? raw.terminalId ?? context.terminalId),
        broker: optionalText(raw.broker ?? context.broker),
        description: optionalText(raw.description) || undefined,
        path: optionalText(raw.path) || undefined,
        digits: Number.isFinite(digitsRaw) ? digitsRaw : undefined,
        type: optionalText(raw.type) || undefined,
    };
}

export function createLegacySymbolDescriptor(symbol: string): SymbolDescriptor {
    const raw = String(symbol || '').trim();
    const upper = raw.toUpperCase();
    const source: MarketDataSource =
        upper === 'SJCVN' || upper === 'DOJIVN'
            ? 'VN_GOLD'
            : upper.includes('USDT')
                ? 'BINANCE'
                : 'MT5';

    return { symbol: raw, source };
}

export function sameSymbolIdentity(a: SymbolDescriptor, b: SymbolDescriptor): boolean {
    return buildSymbolIdentityKey(a) === buildSymbolIdentityKey(b);
}
