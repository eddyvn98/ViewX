import { refreshStoredAccessToken } from '@/lib/auth/session';
import { buildApiUrl, clearLocalAuthState } from '@/hooks/user-setup-sync/sync-utils';
import type { RemoteSyncDeps } from './types';

export function createFetchWithAuthRetry(deps: RemoteSyncDeps) {
    return async (url: string, init: RequestInit): Promise<Response> => {
        // Đính kèm token ngay lần gọi đầu tiên nếu có
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') : null;
        const finalInit = { ...init };
        if (token) {
            const headers = new Headers(finalInit.headers || {});
            headers.set('authorization', `Bearer ${token}`);
            finalInit.headers = headers;
        }

        let response = await fetch(url, finalInit);
        if (response.status !== 401 || !deps.isAuthenticated) {
            return response;
        }

        const refreshedToken = await refreshStoredAccessToken();
        if (!refreshedToken) {
            const remainingToken = typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') : null;
            if (!remainingToken) {
                clearLocalAuthState();
            }
            return response;
        }

        deps.setAuthToken((current) => (current === refreshedToken ? current : refreshedToken));
        const nextHeaders = new Headers(init.headers || {});
        nextHeaders.set('authorization', `Bearer ${refreshedToken}`);
        const retryUrl = buildApiUrl(deps.clientId);
        response = await fetch(retryUrl, {
            ...init,
            headers: nextHeaders,
        });
        return response;
    };
}
