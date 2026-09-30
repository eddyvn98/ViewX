import { shallow } from 'zustand/shallow';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import {
    FALLBACK_SAVE_INTERVAL_MS,
    REMOTE_SYNC_POLL_MS,
} from '@/hooks/user-setup-sync/constants';
import {
    selectPersistableMarketState,
    selectPersistableStrategyState,
} from '@/hooks/user-setup-sync/persistence-utils';
import { createFetchWithAuthRetry } from './remote-sync/auth-fetch';
import { createSaveManager } from './remote-sync/save-manager';
import { pollRemoteState } from './remote-sync/polling';
import { runInitialSync } from './remote-sync/initial-sync';
import type { RemoteSyncDeps } from './remote-sync/types';

export function setupRemoteSyncEffect(deps: RemoteSyncDeps): () => void {
    const { apiUrl } = deps;
    if (!apiUrl) {
        return () => {};
    }

    let isDisposed = false;
    deps.isReadyRef.current = false;

    const fetchWithAuthRetry = createFetchWithAuthRetry(deps);
    const { buildSnapshot, scheduleSave, flushSave } = createSaveManager(deps, fetchWithAuthRetry);
    const isActive = () => !isDisposed;

    void runInitialSync(deps, apiUrl, buildSnapshot, flushSave, isActive, fetchWithAuthRetry);

    const unsubscribeMarket = useMarketStore.subscribe(
        selectPersistableMarketState,
        () => {
            scheduleSave();
        },
        { equalityFn: shallow },
    );
    const unsubscribeStrategy = useStrategyStore.subscribe(
        selectPersistableStrategyState,
        () => {
            scheduleSave();
        },
        { equalityFn: shallow },
    );

    deps.saveIntervalRef.current = setInterval(() => {
        scheduleSave(0);
    }, FALLBACK_SAVE_INTERVAL_MS);
    deps.remotePollTimerRef.current = setInterval(() => {
        void pollRemoteState(deps, buildSnapshot, scheduleSave, fetchWithAuthRetry, isActive);
    }, REMOTE_SYNC_POLL_MS);

    const flushBeforeLeave = () => {
        scheduleSave(0);
        void flushSave(true);
    };
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') flushBeforeLeave();
    };
    window.addEventListener('beforeunload', flushBeforeLeave);
    window.addEventListener('pagehide', flushBeforeLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        isDisposed = true;
        unsubscribeMarket();
        unsubscribeStrategy();
        window.removeEventListener('beforeunload', flushBeforeLeave);
        window.removeEventListener('pagehide', flushBeforeLeave);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (deps.saveTimerRef.current) {
            clearTimeout(deps.saveTimerRef.current);
            deps.saveTimerRef.current = null;
        }
        if (deps.saveIntervalRef.current) {
            clearInterval(deps.saveIntervalRef.current);
            deps.saveIntervalRef.current = null;
        }
        if (deps.remotePollTimerRef.current) {
            clearInterval(deps.remotePollTimerRef.current);
            deps.remotePollTimerRef.current = null;
        }
    };
}
