import type { Dispatch, SetStateAction } from 'react';
import { readStoredAccessToken, refreshStoredAccessToken } from '@/lib/auth/session';

type AuthSyncDeps = {
    setAuthToken: Dispatch<SetStateAction<string>>;
    setAuthResolved: Dispatch<SetStateAction<boolean>>;
};

export function setupAuthSyncEffect({ setAuthToken, setAuthResolved }: AuthSyncDeps): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }

    let isDisposed = false;

    const syncAuthToken = async () => {
        const currentToken = readStoredAccessToken();
        if (currentToken) {
            setAuthToken((current) => (current === currentToken ? current : currentToken));
            if (!isDisposed) setAuthResolved(true);
            return;
        }

        const refreshedToken = await refreshStoredAccessToken();
        if (isDisposed) return;

        setAuthToken((current) => {
            const next = refreshedToken || readStoredAccessToken();
            return current === next ? current : next;
        });
        setAuthResolved(true);
    };

    void syncAuthToken();
    const handleAuthSignal = () => {
        void syncAuthToken();
    };

    window.addEventListener('storage', handleAuthSignal);
    window.addEventListener('focus', handleAuthSignal);
    window.addEventListener('auth-changed', handleAuthSignal);
    window.addEventListener('auth-state-changed', handleAuthSignal);
    document.addEventListener('visibilitychange', handleAuthSignal);

    return () => {
        isDisposed = true;
        window.removeEventListener('storage', handleAuthSignal);
        window.removeEventListener('focus', handleAuthSignal);
        window.removeEventListener('auth-changed', handleAuthSignal);
        window.removeEventListener('auth-state-changed', handleAuthSignal);
        document.removeEventListener('visibilitychange', handleAuthSignal);
    };
}
