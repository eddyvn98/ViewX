import React, { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { dispatchTagEditSaveAction, TagEditState } from '../logic/tag-command-dispatcher';

interface StartTagEditEventDetail {
    ticket: string | number;
    type: string;
    price: number;
    x?: number;
}

interface UseTagEditSessionInput {
    sendMessage?: (data: unknown) => void;
}

export function useTagEditSession({ sendMessage }: UseTagEditSessionInput) {
    const [editingState, setEditingState] = useState<TagEditState | null>(null);
    const isDeletingRef = useRef(false);
    const editingStateRef = useRef<TagEditState | null>(editingState);

    useEffect(() => {
        editingStateRef.current = editingState;
    }, [editingState]);

    const handleInputFinish = React.useCallback((val: number, save: boolean, sessionId?: string) => {
        const state = editingStateRef.current;
        if (sessionId && state?.id !== sessionId) return;

        if (save && state && !isDeletingRef.current) {
            dispatchTagEditSaveAction(state, val, sendMessage);
        }

        setEditingState(null);
    }, [sendMessage]);

    useEffect(() => {
        const handleStartEdit = (e: Event) => {
            const customEvent = e as CustomEvent<StartTagEditEventDetail>;
            const detail = customEvent.detail;
            if (!detail) return;

            const { ticket, type, price, x } = detail;
            let value = price;
            isDeletingRef.current = false;

            if (ticket === 'draft' && type === 'volume') {
                value = useMarketStore.getState().draftOrder?.volume || 0.1;
            }

            setEditingState({
                id: `${ticket}-${type}-${Date.now()}`,
                ticket,
                type,
                price,
                value,
                x
            });
        };

        window.addEventListener('start-tag-edit', handleStartEdit as EventListener);
        return () => window.removeEventListener('start-tag-edit', handleStartEdit as EventListener);
    }, []);

    return {
        editingState,
        setEditingState,
        editingStateRef,
        isDeletingRef,
        handleInputFinish
    };
}
