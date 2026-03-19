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
    emitUserSetupSyncStatus('loading', deps.lastSavedAtRef.current);
    try {
        const response = await fetchWithAuthRetry(apiUrl, {
            method: 'GET',
            headers: getAuthHeaders(deps.clientId),
            credentials: 'include',
        });
        if (!response.ok) {
            deps.isReadyRef.current = true;
            emitUserSetupSyncStatus('error', deps.lastSavedAtRef.current);
            return;
        }

        const data = (await response.json()) as UserStateApiResponse;
        if (!isActive()) return;
        if (isPlainObject(data.state)) {
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
        }
    } catch {
        // Ignore initial sync errors to avoid blocking UI.
    } finally {
        if (!isActive()) return;
        const initialSnapshot = buildSnapshot();
        deps.isReadyRef.current = true;
        if (shouldPersistCurrentSnapshot) {
            const serialized = JSON.stringify(initialSnapshot);
            deps.lastSavedRef.current = '';
            deps.pendingSaveRef.current = { snapshot: initialSnapshot, serialized };
            void flushSave();
        } else {
            deps.lastSavedRef.current = JSON.stringify(initialSnapshot);
            emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
        }
    }
}
