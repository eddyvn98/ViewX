'use client';

type RefreshResponse = {
    access_token?: string;
    user?: unknown;
};

const AUTH_CHANGED_EVENT = 'auth-changed';
let refreshPromise: Promise<string> | null = null;
let silentRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function readStoredAccessToken(): string {
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem('auth_access_token') || '').trim();
}

function readStoredUser(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('auth_user') || '';
}

function parseTokenExpirySec(token: string): number | null {
    if (!token || typeof window === 'undefined') return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = decodeURIComponent(
            atob(normalized)
                .split('')
                .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
                .join(''),
        );
        const parsed = JSON.parse(payloadJson);
        return typeof parsed?.exp === 'number' ? parsed.exp : null;
    } catch {
        return null;
    }
}

function stopSilentRefreshTimer() {
    if (silentRefreshTimer) {
        clearTimeout(silentRefreshTimer);
        silentRefreshTimer = null;
    }
}

function scheduleSilentRefresh(token: string) {
    if (typeof window === 'undefined') return;
    stopSilentRefreshTimer();

    const trimmed = String(token || '').trim();
    if (!trimmed) return;

    const expSec = parseTokenExpirySec(trimmed);
    if (!expSec) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = expSec - nowSec;
    if (remainingSec <= 10) {
        // Token is already about to expire or expired, refresh soon
        silentRefreshTimer = setTimeout(() => {
            void refreshAccessToken();
        }, 2000);
        return;
    }

    // Refresh 2 minutes (120s) before expiry, or at 80% of remaining time if short
    const advanceSec = remainingSec > 180 ? 120 : Math.floor(remainingSec * 0.2);
    const delayMs = Math.max(5, remainingSec - advanceSec) * 1000;

    silentRefreshTimer = setTimeout(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            // When hidden, let visibilitychange handle refresh on user return
            return;
        }
        void refreshAccessToken();
    }, delayMs);
}

function writeStoredSession(accessToken: string, user?: unknown) {
    if (typeof window === 'undefined') return;
    const trimmedToken = String(accessToken || '').trim();
    if (trimmedToken) {
        localStorage.setItem('auth_access_token', trimmedToken);
        scheduleSilentRefresh(trimmedToken);
    } else {
        stopSilentRefreshTimer();
        localStorage.removeItem('auth_access_token');
    }

    if (user !== undefined) {
        localStorage.setItem('auth_user', JSON.stringify(user || {}));
    }

    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function clearStoredSession() {
    if (typeof window === 'undefined') return;
    stopSilentRefreshTimer();
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_user');
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

// Initialise silent refresh on page load if existing access token is stored
if (typeof window !== 'undefined') {
    const existing = readStoredAccessToken();
    if (existing) {
        scheduleSilentRefresh(existing);
    }

    // Proactively refresh when user switches back to this tab if token is nearing expiry
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const current = readStoredAccessToken();
        if (!current) return;
        const expSec = parseTokenExpirySec(current);
        if (!expSec) return;
        const nowSec = Math.floor(Date.now() / 1000);
        // If expired or expiring within 2 minutes, refresh immediately
        if (expSec - nowSec <= 120) {
            void refreshAccessToken();
        } else {
            scheduleSilentRefresh(current);
        }
    });
}

export function getAuthChangedEventName(): string {
    return AUTH_CHANGED_EVENT;
}

export function getStoredAccessToken(): string {
    return readStoredAccessToken();
}

export function getStoredAuthUser(): string {
    return readStoredUser();
}

export function updateStoredSession(accessToken: string, user?: unknown) {
    writeStoredSession(accessToken, user);
}

export function clearStoredAuthSession() {
    clearStoredSession();
}

export async function refreshAccessToken(): Promise<string> {
    if (typeof window === 'undefined') return '';
    if (refreshPromise) return refreshPromise;

    refreshPromise = fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
    })
        .then(async (response) => {
            if (!response.ok) {
                // ONLY clear stored session if the backend explicitly rejected the credentials (401 / 403).
                // Transient server errors (500, 502 Bad Gateway, 503, 504) or network hiccups must NOT
                // wipe the user's session out.
                if (response.status === 401 || response.status === 403) {
                    clearStoredSession();
                }
                return '';
            }

            const data = (await response.json().catch(() => null)) as RefreshResponse | null;
            const token = typeof data?.access_token === 'string' ? data.access_token.trim() : '';
            if (!token) {
                clearStoredSession();
                return '';
            }

            writeStoredSession(token, data?.user);
            return token;
        })
        .catch(() => {
            // Network failure / offline: preserve existing session so user is not logged out abruptly
            return '';
        })
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
}
