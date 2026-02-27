import { useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { TagData, norm } from '../logic/order-tag-utils';
import { getAlertTags } from '../logic/alert-tag-utils';

export function useAlertTags(symbol: string | undefined) {
    const alerts = useMarketStore(state => state.alerts);
    const draggingPosition = useMarketStore(state => state.draggingPosition);

    const tags = useMemo(() => {
        if (!symbol) return [];
        return getAlertTags(alerts, symbol, draggingPosition);
    }, [symbol, alerts, draggingPosition]);

    return { tags };
}

