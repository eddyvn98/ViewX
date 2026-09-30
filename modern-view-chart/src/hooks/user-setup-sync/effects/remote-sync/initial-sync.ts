import {
    applyPersistedSetupState,
    getPersistedUiState,
    isPlainObject,
} from '@/hooks/user-setup-sync/persistence-utils';
import {
    emitUserSetupSyncStatus,
    getAuthHeaders,
} from '@/hooks/user-setup-sync/sync-utils';
import type {
    PersistedSetupState,
    UserStateApiResponse,
} from '@/hooks/user-setup-sync/types';
import type { RemoteSyncDeps } from './types';
import {
    deleteDurableUserSetupOutboxIfNotNewer,
    readDurableUserSetupOutbox,
    shouldPreferDurableOutbox,
} from '@/hooks/user-setup-sync/durable-outbox';

type FetchWithAuthRetry = (url: string, init: RequestInit) => Promise<Response>;

type BuildSnapshot = () => PersistedSetupState;

type IsActive = () => boolean;

type FlushSave = () => Promise<void>;

export async function runInitialSync(
    deps: RemoteSyncDeps,
    apiUrl: string,
    buildSnapshot: BuildSnapshot,
    flushSave: FlushSave,
    isActive: IsActive,
    fetchWithAuthRetry: FetchWithAuthRetry,
): Promise<void> {
    let shouldPersistCurrentSnapshot = false;
    let preferredDurableClientUpdatedAt = 0;
    const durablePending = await readDurableUserSetupOutbox(deps.outboxScopeKey);

    const restoreDurablePending = () => {
        if (!durablePending) return false;
        applyPersistedSetupState(durablePending.snapshot);
        const durableUi = getPersistedUiState(durablePending.snapshot);
        const durableThemeMode = durableUi?.themeMode;
        if (durableThemeMode === 'light' || durableThemeMode === 'dark' || durableThemeMode === 'system') {
            deps.setThemeRef.current(durableThemeMode);
        }
        preferredDurableClientUpdatedAt = durablePending.clientUpdatedAt;
        deps.lastLocalMutationAtRef.current = Math.max(
            deps.lastLocalMutationAtRef.current,
            durablePending.clientUpdatedAt,
        );
        shouldPersistCurrentSnapshot = true;
        return true;
    };

    emitUserSetupSyncStatus('loading', deps.lastSavedAtRef.current);
    try {
        const response = await fetchWithAuthRetry(apiUrl, {
            method: 'GET',
            headers: getAuthHeaders(deps.clientId),
            credentials: 'include',
        });

        if (!response.ok) {
            if (!restoreDurablePending()) {
                emitUserSetupSyncStatus('error', deps.lastSavedAtRef.current);
            }
        } else {
            const data = (await response.json()) as UserStateApiResponse;
            if (!isActive()) return;

            const remoteUpdatedAt = Date.parse(String(data.updated_at || ''));
            if (Number.isFinite(remoteUpdatedAt)) {
                deps.lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
            }
            const remoteRevision = Number(data.revision);
            if (Number.isFinite(remoteRevision) && remoteRevision >= 0) {
                deps.lastRemoteRevisionRef.current = remoteRevision;
            }
            const remoteClientUpdatedAt = Date.parse(String(data.client_updated_at || ''));
            if (Number.isFinite(remoteClientUpdatedAt)) {
                deps.lastAcceptedClientUpdatedAtRef.current = remoteClientUpdatedAt;
            }

            if (shouldPreferDurableOutbox(durablePending, remoteClientUpdatedAt)) {
                restoreDurablePending();
            } else {
                if (durablePending && Number.isFinite(remoteClientUpdatedAt)) {
                    await deleteDurableUserSetupOutboxIfNotNewer(
                        deps.outboxScopeKey,
                        remoteClientUpdatedAt,
                    );
                }

                if (isPlainObject(data.state)) {
                    const hasRemoteState = Object.keys(data.state).length > 0;
                    const persistedUi = getPersistedUiState(data.state);
                    const persistedThemeMode = persistedUi?.themeMode;
                    if (persistedThemeMode === 'light' || persistedThemeMode === 'dark' || persistedThemeMode === 'system') {
                        deps.setThemeRef.current(persistedThemeMode);
                    }
                    if (hasRemoteState) {
                        const hasNewerLocalMutation = deps.lastLocalMutationAtRef.current > (remoteClientUpdatedAt || 0);
                        if (!hasNewerLocalMutation) {
                            applyPersistedSetupState(data.state as Partial<PersistedSetupState>);
                        } else {
                            shouldPersistCurrentSnapshot = true;
                        }
                    } else if (deps.isAuthenticated) {
                        shouldPersistCurrentSnapshot = true;
                    }
                } else if (durablePending) {
                    restoreDurablePending();
                }
            }
        }
    } catch {
        if (!restoreDurablePending()) {
            emitUserSetupSyncStatus('error', deps.lastSavedAtRef.current);
        }
    } finally {
        if (!isActive()) return;
        const initialSnapshot = buildSnapshot();
        deps.isReadyRef.current = true;
        if (shouldPersistCurrentSnapshot) {
            const serialized = JSON.stringify(initialSnapshot);
            const clientUpdatedAt = preferredDurableClientUpdatedAt ||
                deps.lastLocalMutationAtRef.current ||
                Date.now();
            deps.lastSavedRef.current = '';
            deps.pendingSaveRef.current = {
                snapshot: initialSnapshot,
                serialized,
                clientUpdatedAt,
            };
            void flushSave();
        } else {
            deps.lastSavedRef.current = JSON.stringify(initialSnapshot);
            emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
        }
    }
}
