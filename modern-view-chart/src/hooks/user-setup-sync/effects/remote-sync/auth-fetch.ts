import { refreshStoredAccessToken } from '@/lib/auth/session';
import { buildApiUrl, clearLocalAuthState } from '@/hooks/user-setup-sync/sync-utils';
import type { RemoteSyncDeps } from './types';

export function createFetchWithAuthRetry(deps: RemoteSyncDeps) {
    return async (url: string, init: RequestInit): Promise<Response> => {
        let response = await fetch(url, init);
        if (response.status !== 401 || !deps.isAuthenticated) {
            return response;
        }

        const refreshedToken = await refreshStoredAccessToken();
        if (!refreshedToken) {
            clearLocalAuthState();
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
