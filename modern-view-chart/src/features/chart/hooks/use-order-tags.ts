
import { useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { TagData, getPositionTags, getOrderTags, getDraftTags, getVirtualPositionTags, norm } from '../logic/order-tag-utils';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';
import type { Mt5TradingIdentity } from '@/lib/mt5/trading-request';

export function useOrderTags(
    symbol: string | undefined,
    source?: string,
    identity?: Mt5TradingIdentity,
) {
    // Determine target symbol once
    const targetSymbol = useMemo(() => norm(symbol), [symbol]);

    const dataSource = useMemo(
        () => resolveChartIdentityDataSource(source, identity),
        [source, identity],
    );
    const isPersonalMt5 = String(source || '').trim().toUpperCase() === 'MT5_PERSONAL';

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
        const scoped = state.tickers[`${dataSource}:${symbol}`]
            || state.tickers[`${dataSource}:${normSym}`];
        if (isPersonalMt5) return scoped?.price;
        return scoped?.price || state.tickers[symbol]?.price || state.tickers[normSym]?.price;
    });
    const symbolInfo = useMarketStore(state => {
        if (!symbol) return undefined;
        const normSym = normalizeSymbol(symbol);
        const scoped = state.symbolInfo[`${dataSource}:${symbol}`]
            || state.symbolInfo[`${dataSource}:${normSym}`];
        if (isPersonalMt5) return scoped;
        return scoped || state.symbolInfo[normSym];
    });

    const tags = useMemo(() => {
        if (!symbol) return [];

        const result: TagData[] = [];
        const price = currentPrice || 0;

        // 1. Draft
        const draftSource = draftOrder?.source
            ? resolveChartIdentityDataSource(draftOrder.source, draftOrder)
            : dataSource;
        if (
            draftOrder
            && draftSource === dataSource
            && norm(draftOrder.symbol) === targetSymbol
            && !focusedTicket
        ) {
            result.push(...getDraftTags(draftOrder, symbol, price));
        }

        // 2. Real Tags
        // A chart must only expose positions/orders owned by its exact source
        // and MT5 account. Symbol-only filtering can route an edit to the
        // wrong account when two accounts trade the same broker symbol.
        const symPos = positions.filter(
            p => String(p.source || 'MT5') === dataSource && norm(p.symbol) === targetSymbol,
        );
        const symOrd = orders.filter(
            o => String(o.source || 'MT5') === dataSource && norm(o.symbol) === targetSymbol,
        );

        // Filter by focused ticket if active
        const finalPos = focusedTicket ? symPos.filter(p => p.ticket === focusedTicket) : symPos;
        const finalOrd = focusedTicket ? symOrd.filter(o => o.ticket === focusedTicket) : symOrd;

        // Drag visuals are updated directly at the DOM layer while the pointer is moving.
        // Avoid rebuilding the whole tag list on every drag tick.
        result.push(...getPositionTags(finalPos, symbol, null));
        result.push(...getOrderTags(finalOrd, symbol, null));
        result.push(...getVirtualPositionTags(virtualPositions, symbol, null));

        return result;
    }, [symbol, targetSymbol, dataSource, positions, orders, draftOrder, focusedTicket, currentPrice, virtualPositions]);


    return {
        tags,
        currentPrice: currentPrice || 0,
        symbolInfo,
        draftOrder
    };
}
