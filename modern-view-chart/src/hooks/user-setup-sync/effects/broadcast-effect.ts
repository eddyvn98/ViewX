import type { MutableRefObject } from 'react';
import { applyPersistedSetupState, isPlainObject } from '@/hooks/user-setup-sync/persistence-utils';
import { USER_SETUP_SYNC_CHANNEL_NAME } from '@/hooks/user-setup-sync/constants';
import type { PersistedSetupState, UserSetupSyncMessage } from '@/hooks/user-setup-sync/types';

type PendingSave = {
    snapshot: PersistedSetupState;
    serialized: string;
};

type BroadcastEffectDeps = {
    tabSyncSourceId: string;
    syncChannelRef: MutableRefObject<BroadcastChannel | null>;
    lastSavedRef: MutableRefObject<string>;
    pendingSaveRef: MutableRefObject<PendingSave | null>;
    lastAcceptedClientUpdatedAtRef: MutableRefObject<number>;
    lastLocalMutationAtRef: MutableRefObject<number>;
};

export function setupBroadcastEffect({
    tabSyncSourceId,
    syncChannelRef,
    lastSavedRef,
    pendingSaveRef,
    lastAcceptedClientUpdatedAtRef,
    lastLocalMutationAtRef,
}: BroadcastEffectDeps): () => void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
        return () => {};
    }

    const channel = new BroadcastChannel(USER_SETUP_SYNC_CHANNEL_NAME);
    syncChannelRef.current = channel;

    channel.onmessage = (event: MessageEvent<UserSetupSyncMessage>) => {
        const message = event.data;
        if (message?.type !== 'USER_SETUP_STATE_SYNC') return;
        if (message.sourceId === tabSyncSourceId) return;
        if (!isPlainObject(message.state)) return;

        // Never let another tab overwrite local edits that are still waiting to save.
        // The normal server revision/conflict flow will reconcile once this tab flushes.
        if (pendingSaveRef.current) return;

        lastSavedRef.current = message.serialized;
        lastAcceptedClientUpdatedAtRef.current = Math.max(
            lastAcceptedClientUpdatedAtRef.current,
            lastLocalMutationAtRef.current,
        );
        applyPersistedSetupState(message.state, { includeTabs: false });
    };

    return () => {
        channel.close();
        syncChannelRef.current = null;
    };
}
