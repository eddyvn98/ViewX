import { useMarketStore } from '@/lib/store';
import {
    applyPersistedSetupState,
    fitPersistedSetupStateToBudget,
    pickPersistedSetupState,
    isPlainObject,
} from '@/hooks/user-setup-sync/persistence-utils';
import {
    emitUserSetupSyncStatus,
    getAuthHeaders,
    parseRetryAfterMs,
} from '@/hooks/user-setup-sync/sync-utils';
import {
    MIN_SAVE_INTERVAL_MS,
    PUBLIC_STATE_SAVE_PAUSE_MS,
    SAVE_DEBOUNCE_MS,
    USER_STATE_SCHEMA_VERSION,
} from '@/hooks/user-setup-sync/constants';
import type {
    PersistedSetupState,
    UserStateApiResponse,
    UserSetupSyncMessage,
} from '@/hooks/user-setup-sync/types';
import type { RemoteSyncDeps } from './types';

type FetchWithAuthRetry = (url: string, init: RequestInit) => Promise<Response>;

export type SaveManager = {
    buildSnapshot: () => PersistedSetupState;
    scheduleSave: (delayMs?: number) => void;
    flushSave: () => Promise<void>;
};

export function createSaveManager(deps: RemoteSyncDeps, fetchWithAuthRetry: FetchWithAuthRetry): SaveManager {
    const apiUrl = deps.apiUrl;
    if (!apiUrl) {
        throw new Error('Remote sync API URL is required');
    }

    const buildSnapshot = () => {
        const snapshot = pickPersistedSetupState(useMarketStore.getState(), deps.themeRef.current);
        return fitPersistedSetupStateToBudget(snapshot);
    };

    const saveState = async (
        snapshot: PersistedSetupState,
        serialized: string,
        clientUpdatedAt: number,
    ) => {
        if (Date.now() < deps.retryAfterRef.current) return false;
        deps.lastSaveAttemptAtRef.current = Date.now();
        emitUserSetupSyncStatus('saving', deps.lastSavedAtRef.current);
        try {
            const response = await fetchWithAuthRetry(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(deps.clientId),
                },
                credentials: 'include',
                body: JSON.stringify({
                    schema_version: USER_STATE_SCHEMA_VERSION,
                    base_revision: deps.lastRemoteRevisionRef.current,
                    client_updated_at: new Date(clientUpdatedAt).toISOString(),
                    source_client_id: deps.clientId,
                    state: snapshot,
                }),
            });

            const payload = await response.json().catch(() => null) as UserStateApiResponse | null;
            if (response.ok || response.status === 202) {
                deps.lastSavedRef.current = serialized;
                deps.lastSavedAtRef.current = Date.now();
                const remoteUpdatedAt = Date.parse(String(payload?.updated_at || ''));
                if (Number.isFinite(remoteUpdatedAt)) {
                    deps.lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
                }
                const remoteRevision = Number(payload?.revision);
                if (Number.isFinite(remoteRevision) && remoteRevision >= 0) {
                    deps.lastRemoteRevisionRef.current = remoteRevision;
                }
                const remoteClientUpdatedAt = Date.parse(String(payload?.client_updated_at || ''));
                if (Number.isFinite(remoteClientUpdatedAt)) {
                    deps.lastAcceptedClientUpdatedAtRef.current = remoteClientUpdatedAt;
                } else {
                    deps.lastAcceptedClientUpdatedAtRef.current = Math.max(
                        deps.lastAcceptedClientUpdatedAtRef.current,
                        clientUpdatedAt,
                    );
                }
                deps.syncChannelRef.current?.postMessage({
                    type: 'USER_SETUP_STATE_SYNC',
                    sourceId: deps.tabSyncSourceId,
                    state: snapshot,
                    serialized,
                } satisfies UserSetupSyncMessage);
                emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
                deps.retryAfterRef.current = response.status === 202 && !deps.isAuthenticated
                    ? Date.now() + PUBLIC_STATE_SAVE_PAUSE_MS
                    : 0;
                return true;
            }

            if (response.status === 409) {
                const remoteClientUpdatedAt = Date.parse(String(payload?.client_updated_at || ''));
                if (Number.isFinite(remoteClientUpdatedAt)) {
                    deps.lastAcceptedClientUpdatedAtRef.current = remoteClientUpdatedAt;
                }
                const remoteUpdatedAt = Date.parse(String(payload?.updated_at || ''));
                if (Number.isFinite(remoteUpdatedAt)) {
                    deps.lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
                }
                const remoteRevision = Number(payload?.revision);
                if (Number.isFinite(remoteRevision) && remoteRevision >= 0) {
                    deps.lastRemoteRevisionRef.current = remoteRevision;
                }
                const hasNewerLocalMutation = deps.lastLocalMutationAtRef.current > (remoteClientUpdatedAt || 0);
                if (!hasNewerLocalMutation && isPlainObject(payload?.state)) {
                    applyPersistedSetupState(payload.state as Partial<PersistedSetupState>, { includeTabs: false });
                    deps.lastSavedRef.current = JSON.stringify(
                        fitPersistedSetupStateToBudget(
                            pickPersistedSetupState(useMarketStore.getState(), deps.themeRef.current),
                        ),
                    );
                }
                emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
                return true;
            }

            if (response.status === 429) {
                deps.retryAfterRef.current = Date.now() + parseRetryAfterMs(response.headers.get('retry-after'));
            }
        } catch {
            // Keep silent and retry on next user change.
        }
        emitUserSetupSyncStatus('error', deps.lastSavedAtRef.current);
        return false;
    };

    const flushSave = async () => {
        const pending = deps.pendingSaveRef.current;
        if (!pending || !deps.isReadyRef.current) return;

        const now = Date.now();
        const waitForRateLimit = Math.max(0, deps.retryAfterRef.current - now);
        const waitForMinInterval = Math.max(0, MIN_SAVE_INTERVAL_MS - (now - deps.lastSaveAttemptAtRef.current));
        const delay = Math.max(waitForRateLimit, waitForMinInterval);

        if (delay > 0) {
            if (deps.saveTimerRef.current) clearTimeout(deps.saveTimerRef.current);
            deps.saveTimerRef.current = setTimeout(() => {
                void flushSave();
            }, delay);
            return;
        }

        deps.pendingSaveRef.current = null;
        const didSave = await saveState(
            pending.snapshot,
            pending.serialized,
            deps.lastLocalMutationAtRef.current || Date.now(),
        );
        if (!didSave && deps.pendingSaveRef.current === null) {
            deps.pendingSaveRef.current = pending;
        }
    };

    const scheduleSave = (delayMs = SAVE_DEBOUNCE_MS) => {
        if (!deps.isReadyRef.current) return;
        deps.lastLocalMutationAtRef.current = Date.now();
        const snapshot = buildSnapshot();
        const serialized = JSON.stringify(snapshot);
        if (serialized === deps.lastSavedRef.current) return;

        deps.pendingSaveRef.current = { snapshot, serialized };
        emitUserSetupSyncStatus('saving', deps.lastSavedAtRef.current);
        if (deps.saveTimerRef.current) {
            clearTimeout(deps.saveTimerRef.current);
        }
        deps.saveTimerRef.current = setTimeout(() => {
            void flushSave();
            deps.saveTimerRef.current = null;
        }, delayMs);
    };

    return { buildSnapshot, scheduleSave, flushSave };
}
