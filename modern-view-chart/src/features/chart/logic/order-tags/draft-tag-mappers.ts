/* eslint-disable @typescript-eslint/no-explicit-any */
import { TagData } from './types';
import { norm } from './symbol-utils';

export function getDraftTags(draft: any, symbol: string, currentPrice: number): TagData[] {
    if (!draft) return [];
    if (norm(draft.symbol) !== norm(symbol)) return [];

    const result: TagData[] = [];
    const isBuy = draft.type === 'buy';
    const bid = currentPrice || draft.price || 0;
    const ask = bid * 1.0001;
    const entryPrice = draft.isMarket ? (isBuy ? ask : bid) : (draft.price || bid);

    if (entryPrice > 0) {
        result.push({
            id: 'draft-group',
            type: 'draft_group',
            ticket: 'draft',
            price: entryPrice,
            label: isBuy ? 'BUY' : 'SELL',
            color: isBuy ? '#10b981' : '#ef4444',
            pOriginal: { ...draft, price: entryPrice } as any,
        });

        if (draft.sl > 0) {
            result.push({ id: 'draft-sl', type: 'sl', ticket: 'draft', price: draft.sl, label: 'SL', color: '#ef4444', pOriginal: draft });
        }
        if (draft.tp > 0) {
            result.push({ id: 'draft-tp', type: 'tp', ticket: 'draft', price: draft.tp, label: 'TP', color: '#22c55e', pOriginal: draft });
        }
    }

    return result;
}
