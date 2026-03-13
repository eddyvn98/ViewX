
import { useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { TagData, getPositionTags, getOrderTags, getDraftTags, getVirtualPositionTags, norm } from '../logic/order-tag-utils';

export function useOrderTags(symbol: string | undefined) {
    // Determine target symbol once
    const targetSymbol = useMemo(() => norm(symbol), [symbol]);

    // Select only necessary state slices to minimize re-renders
    const positions = useMarketStore(state => state.positions);
    const orders = useMarketStore(state => state.orders);
    const draftOrder = useMarketStore(state => state.draftOrder); // Keep global, filtering inside useMemo is safer for now if we want to avoid deep equality check on selectors
    const focusedTicket = useMarketStore(state => state.focusedTicket);
    const virtualPositions = useStrategyStore(state => state.virtualPositions);

    // Subscribe to symbol-specific data
    const currentPrice = useMarketStore(state => {
        if (!symbol) return undefined;
        const normSym = normalizeSymbol(symbol);
        return state.tickers[normSym]?.price;
    });
    const symbolInfo = useMarketStore(state => {
        if (!symbol) return undefined;
        const normSym = normalizeSymbol(symbol);
        return state.symbolInfo[normSym];
    });

    const tags = useMemo(() => {
        if (!symbol) return [];

        const result: TagData[] = [];
        const price = currentPrice || 0;

        // 1. Draft
        if (draftOrder && norm(draftOrder.symbol) === targetSymbol && !focusedTicket) {
            result.push(...getDraftTags(draftOrder, symbol, price));
        }

        // 2. Real Tags
        // Always show real tags, even if draft exists (User needs context)
        const symPos = positions.filter(p => norm(p.symbol) === targetSymbol);
        const symOrd = orders.filter(o => norm(o.symbol) === targetSymbol);

        // Filter by focused ticket if active
        const finalPos = focusedTicket ? symPos.filter(p => p.ticket === focusedTicket) : symPos;
        const finalOrd = focusedTicket ? symOrd.filter(o => o.ticket === focusedTicket) : symOrd;

        // Drag visuals are updated directly at the DOM layer while the pointer is moving.
        // Avoid rebuilding the whole tag list on every drag tick.
        result.push(...getPositionTags(finalPos, symbol, null));
        result.push(...getOrderTags(finalOrd, symbol, null));
        result.push(...getVirtualPositionTags(virtualPositions, symbol, null));

        return result;
    }, [symbol, targetSymbol, positions, orders, draftOrder, focusedTicket, currentPrice, virtualPositions]);


    return {
        tags,
        currentPrice: currentPrice || 0,
        symbolInfo,
        draftOrder
    };
}
