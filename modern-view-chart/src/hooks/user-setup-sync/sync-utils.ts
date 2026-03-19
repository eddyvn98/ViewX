import { clearStoredAuthSession, readStoredAccessToken } from '@/lib/auth/session';
import { CLIENT_ID_STORAGE_KEY, LEGACY_CLIENT_ID_STORAGE_KEY, RATE_LIMIT_BACKOFF_MS, USER_SETUP_SYNC_STATUS_EVENT } from './constants';
import type { UserSetupSyncStatus } from './types';

export function getOrCreateClientId(): string {
    if (typeof window === 'undefined') return 'public';
    const current = localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim() || '';
    if (current) return current;
    const legacy = localStorage.getItem(LEGACY_CLIENT_ID_STORAGE_KEY)?.trim() || '';
    if (legacy) {
        localStorage.setItem(CLIENT_ID_STORAGE_KEY, legacy);
        return legacy;
    }

    const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
    return generated;
}

export function buildApiUrl(clientId: string): string {
    const params = new URLSearchParams();
    if (clientId) params.set('client_id', clientId);

    const query = params.toString();
    return query ? `/api/user/state?${query}` : '/api/user/state';
}

export function buildPublicApiUrl(clientId: string): string {
    const params = new URLSearchParams();
    if (clientId) params.set('client_id', clientId);

    const query = params.toString();
    return query ? `/api/user/state/public?${query}` : '/api/user/state/public';
}

export function getAuthHeaders(clientId: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (clientId) headers['x-client-id'] = clientId;
    if (typeof window === 'undefined') return headers;
    const accessToken = readStoredAccessToken();
    if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`;
    }
    return headers;
}

export function clearLocalAuthState() {
    clearStoredAuthSession();
}

export function emitUserSetupSyncStatus(status: UserSetupSyncStatus, lastSavedAt: number | null = null) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(USER_SETUP_SYNC_STATUS_EVENT, {
            detail: {
                status,
                lastSavedAt,
            },
        }),
    );
}

export function parseRetryAfterMs(retryAfterHeader: string | null): number {
    const raw = (retryAfterHeader || '').trim();
    if (!raw) return RATE_LIMIT_BACKOFF_MS;

    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000;
    }

    const retryAt = Date.parse(raw);
    if (Number.isFinite(retryAt)) {
        return Math.max(retryAt - Date.now(), RATE_LIMIT_BACKOFF_MS);
    }

    return RATE_LIMIT_BACKOFF_MS;
}
