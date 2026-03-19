import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedSetupState } from '@/hooks/user-setup-sync/types';

export type PendingSave = {
    snapshot: PersistedSetupState;
    serialized: string;
};

export type RemoteSyncDeps = {
    apiUrl: string | null;
    clientId: string;
    isAuthenticated: boolean;
    tabSyncSourceId: string;
    setAuthToken: Dispatch<SetStateAction<string>>;
    isReadyRef: MutableRefObject<boolean>;
    saveTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    saveIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
    remotePollTimerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
    lastSavedRef: MutableRefObject<string>;
    lastSavedAtRef: MutableRefObject<number | null>;
    lastSaveAttemptAtRef: MutableRefObject<number>;
    pendingSaveRef: MutableRefObject<PendingSave | null>;
    retryAfterRef: MutableRefObject<number>;
    syncChannelRef: MutableRefObject<BroadcastChannel | null>;
    lastRemoteUpdatedAtRef: MutableRefObject<number>;
    lastRemoteRevisionRef: MutableRefObject<number>;
    lastLocalMutationAtRef: MutableRefObject<number>;
    lastAcceptedClientUpdatedAtRef: MutableRefObject<number>;
    themeRef: MutableRefObject<'light' | 'dark' | 'system' | undefined>;
    setThemeRef: MutableRefObject<Dispatch<SetStateAction<string>>>;
};
