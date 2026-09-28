import { clearStoredAuthSession, readStoredAccessToken, readStoredAuthUser, refreshStoredAccessToken } from '@/lib/auth/session';
import { wsRuntime } from './runtime';
import { WS_URL_FROM_ENV } from './constants';

export function parseIntervalSeconds(interval: string): number {
    const text = String(interval || '').trim();
    if (!text) return 60;
    const upper = text.toUpperCase();

    if (upper === 'D' || upper === '1D') return 86400;
    if (upper === 'W' || upper === '1W') return 604800;
    if (upper === 'M' || upper === '1M' || upper === '1MO') return 2592000;
    if (upper === 'Y' || upper === '1Y') return 31536000;

    if (/^\d+$/.test(text)) return Number(text) * 60;

    const m = text.match(/^(\d+)\s*([a-z]+)$/i);
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
}

export function deriveWebClientMode(): 'web_free' | 'web_pro' {
    if (typeof window === 'undefined') return 'web_free';

    const raw = readStoredAuthUser();
    if (!raw) return 'web_free';

    try {
        const user = JSON.parse(raw) as Record<string, unknown>;
        const accountTier = String(user.account_tier || '').trim().toLowerCase();
        if (accountTier === 'pro') return 'web_pro';

        const subscription = user.subscription && typeof user.subscription === 'object'
            ? user.subscription as Record<string, unknown>
            : {};
        const plan = String(subscription.plan || user.plan || 'free').trim().toLowerCase();
        return plan === 'pro' || plan === 'pro_plus' ? 'web_pro' : 'web_free';
    } catch {
        return 'web_free';
    }
}

export function deriveDefaultSocketUrl(): string {
    if (typeof window === 'undefined') return wsRuntime.socketUrl || 'ws://127.0.0.1:8091';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const host = window.location.host;
    const isLocalHost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1';
    if (isLocalHost) {
        const localBackendPort =
            window.location.port === '13000'
                ? '18091'
                : window.location.port === '3000'
                    ? '8091'
                    : '18091';
        return `${protocol}//${hostname}:${localBackendPort}`;
    }
    if (WS_URL_FROM_ENV) return WS_URL_FROM_ENV;
    if (wsRuntime.socketUrl) return wsRuntime.socketUrl;

    if (hostname === 'vivutrade.io.vn') {
        return 'wss://api.vivutrade.io.vn';
    }
    if (hostname.endsWith('.vivutrade.io.vn') && !hostname.startsWith('api.')) {
        const suffix = hostname.slice(hostname.indexOf('.'));
        return `${protocol}//api${suffix}`;
    }

    return `${protocol}//${host}`;
}

export function extractCredentialFromUrl(url: URL): string {
    const token = url.searchParams.get('access_token');
    const ticket = url.searchParams.get('access_ticket');
    const credential = (token || ticket || '').trim();
    if (!credential) return '';
    url.searchParams.delete('access_token');
    url.searchParams.delete('access_ticket');
    return credential;
}

export function stripCredentialFromSocketUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        parsed.searchParams.delete('access_token');
        parsed.searchParams.delete('access_ticket');
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

export function buildSocketConfig(options?: { ignoreUrlCredential?: boolean }): { url: string; protocols: string[] } {
    const baseFallback = deriveDefaultSocketUrl();
    if (typeof window === 'undefined') return { url: baseFallback, protocols: [] };

    const params = new URLSearchParams(window.location.search);
    const wsOverride = params.get('ws_url');
    const base = wsOverride || baseFallback;
    const ignoreUrlCredential = Boolean(options?.ignoreUrlCredential);

    try {
        const u = new URL(base);
        let credential = '';
        if (!ignoreUrlCredential) {
            credential = extractCredentialFromUrl(u);
        } else {
            u.searchParams.delete('access_token');
            u.searchParams.delete('access_ticket');
        }
        if (!credential && !ignoreUrlCredential) {
            credential = (params.get('access_token') || params.get('access_ticket') || '').trim();
        }

        const protocols = credential ? [`bearer.${credential}`] : [];
        return { url: u.toString(), protocols };
    } catch {
        const credential = ignoreUrlCredential ? '' : (params.get('access_token') || params.get('access_ticket') || '').trim();
        const protocols = credential ? [`bearer.${credential}`] : [];
        return { url: ignoreUrlCredential ? stripCredentialFromSocketUrl(base) : base, protocols };
    }
}

export async function fetchWsTicketFromApi(): Promise<string> {
    if (typeof window === 'undefined') return '';
    let accessToken = readStoredAccessToken();
    if (!accessToken) return '';

    const nowSec = Math.floor(Date.now() / 1000);
    if (wsRuntime.wsTicketCache && wsRuntime.wsTicketExpiresAt > nowSec + 10) {
        return wsRuntime.wsTicketCache;
    }
    if (wsRuntime.wsTicketPromise) return wsRuntime.wsTicketPromise;

    wsRuntime.wsTicketPromise = fetch('/api/auth/ws-ticket', {
        method: 'GET',
        credentials: 'include',
        headers: {
            authorization: `Bearer ${accessToken}`,
        },
    })
        .then(async (response) => {
            if (response.status === 401) {
                const refreshedToken = await refreshStoredAccessToken();
                if (!refreshedToken) {
                    if (!readStoredAccessToken()) {
                        clearStoredAuthSession();
                    }
                    return '';
                }

                accessToken = refreshedToken;
                response = await fetch('/api/auth/ws-ticket', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                });
            }
            if (!response.ok) {
                // Fallback to direct user access token for WS auth when the
                // ws-ticket endpoint or upstream proxy is temporarily broken.
                return accessToken;
            }
            const data = await response.json().catch(() => null);
            const ticket = typeof data?.access_ticket === 'string' ? data.access_ticket.trim() : '';
            const expiresAt = Number.parseInt(String(data?.expires_at || '0'), 10);
            if (!ticket) {
                return accessToken;
            }
            wsRuntime.wsTicketCache = ticket;
            wsRuntime.wsTicketExpiresAt = Number.isFinite(expiresAt) ? expiresAt : Math.floor(Date.now() / 1000) + 300;
            return wsRuntime.wsTicketCache;
        })
        .catch(() => accessToken || '')
        .finally(() => {
            wsRuntime.wsTicketPromise = null;
        });

    return wsRuntime.wsTicketPromise;
}
