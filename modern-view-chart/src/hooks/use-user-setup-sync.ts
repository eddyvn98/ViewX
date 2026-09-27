'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { readStoredAccessToken } from '@/lib/auth/session';
import { buildApiUrl, buildPublicApiUrl, getOrCreateClientId } from '@/hooks/user-setup-sync/sync-utils';
import type { PersistedSetupState } from '@/hooks/user-setup-sync/types';
import { setupAuthSyncEffect } from '@/hooks/user-setup-sync/effects/auth-sync-effect';
import { setupBroadcastEffect } from '@/hooks/user-setup-sync/effects/broadcast-effect';
import { setupRemoteSyncEffect } from '@/hooks/user-setup-sync/effects/remote-sync-effect';

export function useUserSetupSync() {
    const { theme, setTheme } = useTheme();
    const [authToken, setAuthToken] = useState<string>(() => readStoredAccessToken());
    const [authResolved, setAuthResolved] = useState<boolean>(() => typeof window === 'undefined');
    const clientId = useMemo(() => (typeof window === 'undefined' ? 'public' : getOrCreateClientId()), []);
    const fallbackTabId = useId();
    const tabSyncSourceId = useMemo(
        () => (
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `tab-${fallbackTabId}`
        ),
        [fallbackTabId],
    );
    const isAuthenticated = authToken.length > 0;
    const apiUrl = useMemo(() => {
        if (typeof window === 'undefined') return '/api/user/state';
        if (!authResolved) return null;
        return isAuthenticated ? buildApiUrl(clientId) : buildPublicApiUrl(clientId);
    }, [authResolved, clientId, isAuthenticated]);

    const isReadyRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSavedRef = useRef('');
    const lastSaveAttemptAtRef = useRef(0);
    const pendingSaveRef = useRef<{ snapshot: PersistedSetupState; serialized: string } | null>(null);
    const retryAfterRef = useRef(0);
    const remotePollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const themeRef = useRef<'light' | 'dark' | 'system' | undefined>(undefined);
    const setThemeRef = useRef(setTheme);
    const syncChannelRef = useRef<BroadcastChannel | null>(null);
    const lastSavedAtRef = useRef<number | null>(null);
    const lastRemoteUpdatedAtRef = useRef<number>(0);
    const lastRemoteRevisionRef = useRef<number>(0);
    const lastLocalMutationAtRef = useRef<number>(0);
    const lastAcceptedClientUpdatedAtRef = useRef<number>(0);

    useEffect(() => {
        themeRef.current = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : undefined;
    }, [theme]);

    useEffect(() => {
        setThemeRef.current = setTheme;
    }, [setTheme]);

    useEffect(() => setupBroadcastEffect({
        tabSyncSourceId,
        syncChannelRef,
        lastSavedRef,
        pendingSaveRef,
        lastAcceptedClientUpdatedAtRef,
        lastLocalMutationAtRef,
    }), [tabSyncSourceId]);

    useEffect(() => setupAuthSyncEffect({ setAuthToken, setAuthResolved }), []);

    useEffect(() => {
        if (process.env.NEXT_PUBLIC_E2E === '1') return;
        return setupRemoteSyncEffect({
        apiUrl,
        clientId,
        isAuthenticated,
        tabSyncSourceId,
        setAuthToken,
        isReadyRef,
        saveTimerRef,
        saveIntervalRef,
        remotePollTimerRef,
        lastSavedRef,
        lastSavedAtRef,
        lastSaveAttemptAtRef,
        pendingSaveRef,
        retryAfterRef,
        syncChannelRef,
        lastRemoteUpdatedAtRef,
        lastRemoteRevisionRef,
        lastLocalMutationAtRef,
        lastAcceptedClientUpdatedAtRef,
        themeRef,
        setThemeRef,
        });
    }, [apiUrl, clientId, isAuthenticated, tabSyncSourceId]);
}
