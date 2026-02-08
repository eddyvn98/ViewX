
import { useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { TagData, getPositionTags, getOrderTags, getDraftTags, norm } from '../logic/order-tag-utils';

export function useOrderTags(symbol: string | undefined) {
    // Determine target symbol once
    const targetSymbol = useMemo(() => norm(symbol), [symbol]);

    // Select only necessary state slices to minimize re-renders
    const positions = useMarketStore(state => state.positions);
    const orders = useMarketStore(state => state.orders);
    const draftOrder = useMarketStore(state => state.draftOrder); // Keep global, filtering inside useMemo is safer for now if we want to avoid deep equality check on selectors
    const focusedTicket = useMarketStore(state => state.focusedTicket);
    const draggingPosition = useMarketStore(state => state.draggingPosition);

    // Subscribe to symbol-specific data
    const currentPrice = useMarketStore(state => symbol ? state.tickers[symbol]?.price : undefined);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);

    const tags = useMemo(() => {
        if (!symbol) return [];

        let result: TagData[] = [];
        const price = currentPrice || 0;

        // 1. Draft
        if (draftOrder && norm(draftOrder.symbol) === targetSymbol && !focusedTicket) {
            result.push(...getDraftTags(draftOrder, symbol, price));
        }

        // 2. Real Tags
        const hasActiveDraft = draftOrder && norm(draftOrder.symbol) === targetSymbol;
        if (!hasActiveDraft) {
            // Filter by symbol first
            const symPos = positions.filter(p => norm(p.symbol) === targetSymbol);
            const symOrd = orders.filter(o => norm(o.symbol) === targetSymbol);

            // Filter by focused ticket if active
            const finalPos = focusedTicket ? symPos.filter(p => p.ticket === focusedTicket) : symPos;
            const finalOrd = focusedTicket ? symOrd.filter(o => o.ticket === focusedTicket) : symOrd;

            result.push(...getPositionTags(finalPos, symbol, draggingPosition));
            result.push(...getOrderTags(finalOrd, symbol, draggingPosition));
        }

        return result;

    }, [symbol, targetSymbol, positions, orders, draftOrder, focusedTicket, draggingPosition, currentPrice]);

    return {
        tags,
        currentPrice: currentPrice || 0,
        symbolInfo,
        draftOrder
    };
}
