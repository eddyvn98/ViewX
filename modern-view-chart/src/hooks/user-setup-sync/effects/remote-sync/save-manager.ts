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
import {
    deleteDurableUserSetupOutboxForSource,
    deleteDurableUserSetupOutboxIfNotNewer,
    writeDurableUserSetupOutbox,
} from '@/hooks/user-setup-sync/durable-outbox';

type FetchWithAuthRetry = (url: string, init: RequestInit) => Promise<Response>;

export type SaveManager = {
    buildSnapshot: () => PersistedSetupState;
    scheduleSave: (delayMs?: number) => void;
    flushSave: (force?: boolean) => Promise<void>;
};

export function createSaveManager(deps: RemoteSyncDeps, fetchWithAuthRetry: FetchWithAuthRetry): SaveManager {
    const apiUrl = deps.apiUrl;
    if (!apiUrl) {
        throw new Error('Remote sync API URL is required');
    }

    let isFlushing = false;

    const buildSnapshot = () => {
        const snapshot = pickPersistedSetupState(useMarketStore.getState(), deps.themeRef.current);
        return fitPersistedSetupStateToBudget(snapshot);
    };

    const saveState = async (
        snapshot: PersistedSetupState,
        serialized: string,
        clientUpdatedAt: number,
    ): Promise<'saved' | 'remote-won' | 'retry-now' | 'retry-later'> => {
        if (Date.now() < deps.retryAfterRef.current) return 'retry-later';
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
            if (response.ok && response.status !== 202) {
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
                deps.retryAfterRef.current = 0;
                return 'saved';
            }

            if (response.status === 202) {
                deps.retryAfterRef.current = Date.now() + PUBLIC_STATE_SAVE_PAUSE_MS;
                return 'retry-later';
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
                if (hasNewerLocalMutation) {
                    return 'retry-now';
                }
                if (isPlainObject(payload?.state)) {
                    applyPersistedSetupState(payload.state as Partial<PersistedSetupState>, { includeTabs: false });
                    deps.lastSavedRef.current = JSON.stringify(
                        fitPersistedSetupStateToBudget(
                            pickPersistedSetupState(useMarketStore.getState(), deps.themeRef.current),
                        ),
                    );
                }
                emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
                return 'remote-won';
            }

            if (response.status === 429) {
                deps.retryAfterRef.current = Date.now() + parseRetryAfterMs(response.headers.get('retry-after'));
            }
        } catch {
            // Keep the durable outbox record and retry when connectivity recovers.
        }
        emitUserSetupSyncStatus('error', deps.lastSavedAtRef.current);
        return 'retry-later';
    };

    const flushSave = async (force = false) => {
        const pending = deps.pendingSaveRef.current;
        if (!pending || !deps.isReadyRef.current) return;

        await writeDurableUserSetupOutbox(
            deps.outboxScopeKey,
            deps.tabSyncSourceId,
            pending.snapshot,
            pending.clientUpdatedAt,
        );

        const now = Date.now();
        const waitForRateLimit = Math.max(0, deps.retryAfterRef.current - now);
        const waitForMinInterval = Math.max(0, MIN_SAVE_INTERVAL_MS - (now - deps.lastSaveAttemptAtRef.current));
        const delay = force ? 0 : Math.max(waitForRateLimit, waitForMinInterval);

        if (delay > 0) {
            if (deps.saveTimerRef.current) clearTimeout(deps.saveTimerRef.current);
            deps.saveTimerRef.current = setTimeout(() => {
                void flushSave();
            }, delay);
            return;
        }

        if (isFlushing) return;
        isFlushing = true;
        deps.pendingSaveRef.current = null;

        let result: 'saved' | 'remote-won' | 'retry-now' | 'retry-later';
        try {
            result = await saveState(
                pending.snapshot,
                pending.serialized,
                pending.clientUpdatedAt,
            );
        } finally {
            isFlushing = false;
        }

        if (result === 'saved' || result === 'remote-won') {
            await deleteDurableUserSetupOutboxIfNotNewer(
                deps.outboxScopeKey,
                pending.clientUpdatedAt,
            );
            if (deps.pendingSaveRef.current) {
                if (deps.saveTimerRef.current) clearTimeout(deps.saveTimerRef.current);
                deps.saveTimerRef.current = setTimeout(() => {
                    void flushSave();
                }, 0);
            }
            return;
        }

        if (deps.pendingSaveRef.current === null) {
            deps.pendingSaveRef.current = pending;
        }

        if (result === 'retry-now') {
            if (deps.saveTimerRef.current) clearTimeout(deps.saveTimerRef.current);
            deps.saveTimerRef.current = setTimeout(() => {
                void flushSave();
            }, 0);
        }
    };

    const scheduleSave = (delayMs = SAVE_DEBOUNCE_MS) => {
        if (!deps.isReadyRef.current) return;
        const snapshot = buildSnapshot();
        const serialized = JSON.stringify(snapshot);
        const matchesLastSaved = serialized === deps.lastSavedRef.current;

        if (matchesLastSaved && !isFlushing) {
            deps.pendingSaveRef.current = null;
            if (deps.saveTimerRef.current) {
                clearTimeout(deps.saveTimerRef.current);
                deps.saveTimerRef.current = null;
            }
            void deleteDurableUserSetupOutboxForSource(
                deps.outboxScopeKey,
                deps.tabSyncSourceId,
            );
            emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
            return;
        }

        const clientUpdatedAt = Date.now();
        deps.lastLocalMutationAtRef.current = clientUpdatedAt;
        deps.pendingSaveRef.current = { snapshot, serialized, clientUpdatedAt };
        void writeDurableUserSetupOutbox(
            deps.outboxScopeKey,
            deps.tabSyncSourceId,
            snapshot,
            clientUpdatedAt,
        );
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
