import { normalizeSymbol } from '@/lib/utils/symbol';

export type Mt5AccountScope = {
    source: 'MT5' | 'MT5_PERSONAL';
    accountLogin: string | null;
    terminalId: string | null;
    broker: string | null;
};

const STORAGE_KEY = 'vivutrade_selected_mt5_scope';

export const SHARED_MT5_SCOPE: Mt5AccountScope = {
    source: 'MT5',
    accountLogin: null,
    terminalId: null,
    broker: null,
};

function normalizeOptional(value: unknown): string | null {
    const text = String(value || '').trim();
    return text || null;
}

export function normalizeMt5AccountScope(value: unknown): Mt5AccountScope {
    const raw = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
    const accountLogin = normalizeOptional(raw.accountLogin ?? raw.account_login);
    const requestedPersonal = String(raw.source || '').trim().toUpperCase() === 'MT5_PERSONAL';
    const source = requestedPersonal && accountLogin ? 'MT5_PERSONAL' : 'MT5';

    if (source === 'MT5') {
        return SHARED_MT5_SCOPE;
    }

    return {
        source,
        accountLogin,
        terminalId: normalizeOptional(raw.terminalId ?? raw.terminal_id),
        broker: normalizeOptional(raw.broker),
    };
}

export function buildMt5DataSourceKey(scopeInput: unknown): string {
    const scope = normalizeMt5AccountScope(scopeInput);
    if (scope.source !== 'MT5_PERSONAL' || !scope.accountLogin) return 'MT5';
    return [
        'MT5_PERSONAL',
        scope.accountLogin,
        scope.terminalId || '__default_terminal__',
    ].join('@');
}

export function resolveChartDataSource(source: string | undefined, scopeInput: unknown): string {
    const normalized = String(source || '').trim().toUpperCase();
    if (normalized !== 'MT5') return normalized || String(source || '');
    return buildMt5DataSourceKey(scopeInput);
}

export function resolveChartIdentityDataSource(
    source: string | undefined,
    identity?: {
        accountLogin?: string | null;
        terminalId?: string | null;
        broker?: string | null;
    },
): string {
    const normalized = String(source || '').trim().toUpperCase();
    if (normalized === 'MT5_PERSONAL') {
        return buildMt5DataSourceKey({
            source: 'MT5_PERSONAL',
            accountLogin: identity?.accountLogin,
            terminalId: identity?.terminalId,
            broker: identity?.broker,
        });
    }
    if (normalized === 'MT5') return 'MT5';
    return normalized || String(source || '');
}

export function buildTickerStoreKeys(source: string, symbol: string): string[] {
    const exactSymbol = String(symbol || '').trim();
    const normalizedSymbol = normalizeSymbol(exactSymbol);
    if (!exactSymbol && !normalizedSymbol) return [];

    const normalizedSource = String(source || '').trim() || 'MT5';
    const keys = new Set<string>();
    if (exactSymbol) keys.add(`${normalizedSource}:${exactSymbol}`);
    if (normalizedSymbol) keys.add(`${normalizedSource}:${normalizedSymbol}`);
    if (exactSymbol) keys.add(exactSymbol);
    if (normalizedSymbol) keys.add(normalizedSymbol);
    return Array.from(keys);
}

export function buildMt5AuthFields(scopeInput: unknown): Record<string, string | null> {
    const scope = normalizeMt5AccountScope(scopeInput);
    return {
        mt5_source: scope.source,
        account_login: scope.accountLogin,
        terminal_id: scope.terminalId,
    };
}

export function readStoredMt5Scope(): Mt5AccountScope {
    if (typeof window === 'undefined') return SHARED_MT5_SCOPE;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SHARED_MT5_SCOPE;
    try {
        return normalizeMt5AccountScope(JSON.parse(raw));
    } catch {
        return SHARED_MT5_SCOPE;
    }
}

export function persistMt5Scope(scopeInput: unknown): Mt5AccountScope {
    const scope = normalizeMt5AccountScope(scopeInput);
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
    }
    return scope;
}

export function sameMt5Scope(aInput: unknown, bInput: unknown): boolean {
    const a = normalizeMt5AccountScope(aInput);
    const b = normalizeMt5AccountScope(bInput);
    return a.source === b.source
        && a.accountLogin === b.accountLogin
        && a.terminalId === b.terminalId;
}
