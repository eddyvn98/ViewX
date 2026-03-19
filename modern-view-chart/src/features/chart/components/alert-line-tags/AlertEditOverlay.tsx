import React, { memo, useEffect, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';

interface AlertEditOverlayProps {
    state: any;
    series: any;
    isDeletingRef: React.RefObject<boolean>;
    onFinish: (val: number, save: boolean, sessionId?: string) => void;
}

export const AlertEditOverlay = memo(function AlertEditOverlay({ state, series, isDeletingRef, onFinish }: AlertEditOverlayProps) {
    const isInteractingRef = useRef(false);
    const removeAlert = useMarketStore(state => state.removeAlert);

    const [livePrice, setLivePrice] = useState(state.price);
    useEffect(() => {
        return useMarketStore.subscribe(s => s.draggingPosition, (drag) => {
            if (drag && drag.ticket === state.ticket && drag.type === 'alert') setLivePrice(drag.price);
        });
    }, [state.ticket]);

    const coord = series.priceToCoordinate(livePrice) || 0;

    return (
        <div
            className="edit-overlay absolute z-[15] flex flex-col items-center gap-1.5 pointer-events-auto touch-action-none"
            onContextMenu={e => e.preventDefault()}
            style={{ transform: `translateY(${coord - 13}px)`, left: state.x !== undefined ? `${state.x}px` : 'auto', right: state.x !== undefined ? 'auto' : '11px' }}
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
            <div className="h-8 min-w-[80px] w-[90px] bg-background/60 backdrop-blur-xl border border-amber-500/20 shadow-ethereal overflow-hidden rounded-lg text-center shrink-0">
                <input
                    autoFocus
                    type="number"
                    step="0.00001"
                    defaultValue={state.value}
                    className="w-full h-full bg-transparent text-white text-[12px] font-mono font-bold text-center outline-none px-1"
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
                title="Delete Alert"
                className="delete-btn flex items-center justify-center h-8 w-8 bg-black/60 backdrop-blur-md border border-red-500/50 hover:bg-red-500 hover:border-red-500 rounded-full shadow-lg transition-all active:scale-90 group"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isDeletingRef.current = true;
                    removeAlert(state.ticket);
                    onFinish(0, false, state.id);
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 group-hover:text-white transition-colors">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    );
});
