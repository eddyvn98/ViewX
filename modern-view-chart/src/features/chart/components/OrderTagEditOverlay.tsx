import React, { memo, useEffect, useRef, useState } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { dispatchTagDeleteAction, TagEditState } from '../logic/tag-command-dispatcher';

interface OrderTagEditOverlayProps {
    state: TagEditState;
    series: ISeriesApi<'Candlestick'>;
    isDeletingRef: React.RefObject<boolean>;
    onFinish: (val: number, save: boolean, sessionId?: string) => void;
    sendMessage?: (msg: unknown) => void;
}

export const OrderTagEditOverlay = memo(function OrderTagEditOverlay({
    state,
    series,
    isDeletingRef,
    onFinish,
    sendMessage
}: OrderTagEditOverlayProps) {
    const [livePrice, setLivePrice] = useState(state.price);
    const isInteractingRef = useRef(false);

    useEffect(() => {
        const unsub = useMarketStore.subscribe(
            s => s.draggingPosition,
            (drag) => {
                if (drag && drag.ticket === state.ticket && drag.type === state.type) {
                    setLivePrice(drag.price);
                }
            }
        );

        const unsubDraft = useMarketStore.subscribe(
            s => s.draftOrder,
            (draft) => {
                if (state.ticket === 'draft' && draft) {
                    const nextPrice =
                        state.type === 'entry' ? draft.price :
                            state.type === 'sl' ? draft.sl :
                                state.type === 'tp' ? draft.tp :
                                    undefined;

                    if (typeof nextPrice === 'number') {
                        setLivePrice(nextPrice);
                    }
                }
            }
        );

        return () => {
            unsub();
            unsubDraft();
        };
    }, [state.ticket, state.type]);

    const coord = series.priceToCoordinate(livePrice) || 0;

    return (
        <div
            className="edit-overlay absolute z-[25] flex flex-col items-center gap-2 pointer-events-auto touch-action-none"
            onContextMenu={e => e.preventDefault()}
            style={{
                transform: `translateY(${coord - 13}px)`,
                left: state.x !== undefined ? `${state.x - 30}px` : 'auto',
                right: state.x !== undefined ? 'auto' : '0px',
            }}
            onPointerDown={e => {
                if (e.pointerType === 'touch') e.preventDefault();
                e.stopPropagation();
                isInteractingRef.current = true;
            }}
            onPointerUp={e => {
                e.stopPropagation();
                isInteractingRef.current = false;
            }}
        >
            <div className="h-8 min-w-[90px] bg-background/60 backdrop-blur-xl border border-primary/20 shadow-glow overflow-hidden rounded-lg">
                <input
                    autoFocus
                    type="number"
                    step="0.00001"
                    defaultValue={state.value}
                    className="w-full h-full bg-transparent text-foreground text-[13px] font-bold text-center outline-none px-2"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onFinish(parseFloat((e.target as HTMLInputElement).value), true, state.id);
                        if (e.key === 'Escape') {
                            isDeletingRef.current = true;
                            onFinish(0, false, state.id);
                        }
                    }}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    onBlur={(e) => {
                        if (isDeletingRef.current || isInteractingRef.current) return;
                        setTimeout(() => {
                            if (isDeletingRef.current || isInteractingRef.current) return;
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            onFinish(isNaN(val) ? 0 : val, !isNaN(val), state.id);
                        }, 200);
                    }}
                />
            </div>

            <button
                type="button"
                data-no-drag="true"
                title="XoÃ¡ lá»‡nh"
                className="delete-btn flex items-center justify-center w-8 h-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white backdrop-blur-md border border-red-500/20 rounded-lg shadow-lg active:scale-95 transition-all"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isDeletingRef.current = true;
                    dispatchTagDeleteAction(state, sendMessage);
                    onFinish(0, false, state.id);
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    );
});
