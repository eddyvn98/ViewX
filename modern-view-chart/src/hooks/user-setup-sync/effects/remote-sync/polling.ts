import { useMarketStore } from '@/lib/store';
import {
    applyPersistedSetupState,
    fitPersistedSetupStateToBudget,
    isPlainObject,
    pickPersistedSetupState,
} from '@/hooks/user-setup-sync/persistence-utils';
import {
    buildApiUrl,
    emitUserSetupSyncStatus,
    getAuthHeaders,
} from '@/hooks/user-setup-sync/sync-utils';
import type { PersistedSetupState } from '@/hooks/user-setup-sync/types';
import type { RemoteSyncDeps } from './types';

type BuildSnapshot = () => PersistedSetupState;
type ScheduleSave = (delayMs?: number) => void;
type IsActive = () => boolean;
type FetchWithAuthRetry = (url: string, init: RequestInit) => Promise<Response>;

export async function pollRemoteState(
    deps: RemoteSyncDeps,
    buildSnapshot: BuildSnapshot,
    scheduleSave: ScheduleSave,
    fetchWithAuthRetry: FetchWithAuthRetry,
    isActive: IsActive,
): Promise<void> {
    if (!isActive() || !deps.isReadyRef.current || !deps.isAuthenticated) return;
    if (deps.pendingSaveRef.current) return;

    try {
        const response = await fetchWithAuthRetry(buildApiUrl(deps.clientId), {
            method: 'GET',
            headers: getAuthHeaders(deps.clientId),
            credentials: 'include',
        });
        if (!response.ok) return;

        const data = (await response.json()) as {
            state?: Record<string, unknown>;
            updated_at?: string | null;
            revision?: number;
            client_updated_at?: string | null;
        };
        if (!isPlainObject(data.state)) return;

        const remoteUpdatedAt = Date.parse(String(data.updated_at || ''));
        if (!Number.isFinite(remoteUpdatedAt) || remoteUpdatedAt <= deps.lastRemoteUpdatedAtRef.current) return;
        const remoteRevision = Number(data.revision);
        const remoteClientUpdatedAt = Date.parse(String(data.client_updated_at || ''));

        const currentSnapshot = fitPersistedSetupStateToBudget(
            pickPersistedSetupState(useMarketStore.getState(), deps.themeRef.current),
        );
        const currentSerialized = JSON.stringify(currentSnapshot);
        const remoteSerialized = JSON.stringify(data.state);

        deps.lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
        if (Number.isFinite(remoteRevision) && remoteRevision >= 0) {
            deps.lastRemoteRevisionRef.current = remoteRevision;
        }
        if (remoteSerialized === currentSerialized || remoteSerialized === deps.lastSavedRef.current) return;
        if (Number.isFinite(remoteClientUpdatedAt) && deps.lastLocalMutationAtRef.current > remoteClientUpdatedAt) {
            scheduleSave(0);
            return;
        }

        applyPersistedSetupState(data.state as Partial<PersistedSetupState>, { includeTabs: false });
        if (Number.isFinite(remoteClientUpdatedAt)) {
            deps.lastAcceptedClientUpdatedAtRef.current = remoteClientUpdatedAt;
        }
        deps.lastSavedRef.current = JSON.stringify(
            fitPersistedSetupStateToBudget(
                pickPersistedSetupState(useMarketStore.getState(), deps.themeRef.current),
            ),
        );
        emitUserSetupSyncStatus('saved', deps.lastSavedAtRef.current);
    } catch {
        // Ignore polling failures; local runner should continue uninterrupted.
    }
}
