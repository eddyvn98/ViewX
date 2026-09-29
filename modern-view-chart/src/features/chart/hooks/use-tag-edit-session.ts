import React, { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { dispatchTagEditSaveAction, TagEditState } from '../logic/tag-command-dispatcher';
import type { Mt5TradingIdentity } from '@/lib/mt5/trading-request';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';

interface StartTagEditEventDetail {
    ticket: string | number;
    type: string;
    price: number;
    x?: number;
    dataSource?: string;
}

interface UseTagEditSessionInput {
    sendMessage?: (data: unknown) => void;
    identity?: Mt5TradingIdentity;
}

export function useTagEditSession({ sendMessage, identity }: UseTagEditSessionInput) {
    const dataSource = resolveChartIdentityDataSource(identity?.source || undefined, identity);
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
            dispatchTagEditSaveAction(state, val, sendMessage, identity);
        }

        setEditingState(null);
    }, [sendMessage, identity]);

    useEffect(() => {
        const handleStartEdit = (e: Event) => {
            const customEvent = e as CustomEvent<StartTagEditEventDetail>;
            const detail = customEvent.detail;
            if (!detail) return;

            if (detail.dataSource && detail.dataSource !== dataSource) return;
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
    }, [dataSource]);

    return {
        editingState,
        setEditingState,
        editingStateRef,
        isDeletingRef,
        handleInputFinish
    };
}
