export type TradingSource = 'MT5' | 'BINANCE';

const KEY_PREFIX = 'vx_legal_consent_v1';

function getConsentKey(source: TradingSource): string {
    return `${KEY_PREFIX}:${source}`;
}

function getNowIso(): string {
    return new Date().toISOString();
}

export function hasLegalConsent(source: TradingSource): boolean {
    if (typeof window === 'undefined') return false;
    const key = getConsentKey(source);
    const value = window.localStorage.getItem(key);
    if (!value) return false;
    try {
        const parsed = JSON.parse(value) as { accepted?: boolean };
        return Boolean(parsed?.accepted);
    } catch {
        return value === '1' || value === 'true';
    }
}

export function saveLegalConsent(source: TradingSource): void {
    if (typeof window === 'undefined') return;
    const key = getConsentKey(source);
    const payload = {
        accepted: true,
        acceptedAt: getNowIso(),
        source,
        version: 'v1',
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
}

export function clearLegalConsent(source: TradingSource): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(getConsentKey(source));
}

