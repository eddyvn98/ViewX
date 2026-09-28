import { buildMt5AuthFields, normalizeMt5AccountScope } from './account-scope';

export type Mt5TradingIdentity = {
    source?: string | null;
    accountLogin?: string | null;
    terminalId?: string | null;
    broker?: string | null;
};

export function createMt5RequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `mt5-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildMt5WriteFields(identity?: Mt5TradingIdentity): Record<string, string | null> & { request_id: string } {
    const source = String(identity?.source || '').trim().toUpperCase();
    const scope = normalizeMt5AccountScope({
        source: source === 'MT5_PERSONAL' ? 'MT5_PERSONAL' : 'MT5',
        accountLogin: identity?.accountLogin,
        terminalId: identity?.terminalId,
        broker: identity?.broker,
    });

    return {
        request_id: createMt5RequestId(),
        ...buildMt5AuthFields(scope),
        broker: scope.broker,
    };
}
