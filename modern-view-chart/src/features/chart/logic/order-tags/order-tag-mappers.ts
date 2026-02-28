/* eslint-disable @typescript-eslint/no-explicit-any */
import { Order } from '@/lib/store';
import { TagData } from './types';
import { norm } from './symbol-utils';
import { resolveEntryColor, resolveLevelColor } from './color-resolvers';

export function getOrderTags(orders: Order[], symbol: string, draggingState: any): TagData[] {
    const matches = (s1: string, s2: string) => norm(s1) === norm(s2);
    const result: TagData[] = [];

    orders.filter(o => matches(o.symbol, symbol)).forEach(ord => {
        let entryPrice = ord.price_open;
        if (draggingState && draggingState.ticket === ord.ticket && draggingState.type === 'entry') entryPrice = draggingState.price;

        const isBuy = ord.type.toLowerCase().includes('buy');
        const typeLabel = ord.type.toUpperCase().replace(' LIMIT', ' LMT').replace(' STOP', ' STP');
        const isExternalBot = Number((ord as any).magic || 0) > 0;
        const entryColor = resolveEntryColor({ isBuy, isPending: true, isExternal: isExternalBot });

        result.push({
            id: `${ord.ticket}-entry`,
            type: 'entry',
            ticket: ord.ticket,
            price: entryPrice,
            anchorTime: ord.entry_time ?? ord.time,
            label: isExternalBot ? `EXT BOT ${typeLabel}` : typeLabel,
            color: entryColor,
            pOriginal: ord,
        });

        if (ord.sl > 0) {
            let slPrice = ord.sl;
            if (draggingState && draggingState.ticket === ord.ticket && draggingState.type === 'sl') slPrice = draggingState.price;
            result.push({
                id: `${ord.ticket}-sl`,
                type: 'sl',
                ticket: ord.ticket,
                price: slPrice,
                anchorTime: ord.sl_time ?? ord.entry_time ?? ord.time,
                label: 'SL',
                color: resolveLevelColor('sl', { isExternal: isExternalBot }),
                pOriginal: ord,
            });
        }

        if (ord.tp > 0) {
            let tpPrice = ord.tp;
            if (draggingState && draggingState.ticket === ord.ticket && draggingState.type === 'tp') tpPrice = draggingState.price;
            result.push({
                id: `${ord.ticket}-tp`,
                type: 'tp',
                ticket: ord.ticket,
                price: tpPrice,
                anchorTime: ord.tp_time ?? ord.entry_time ?? ord.time,
                label: 'TP',
                color: resolveLevelColor('tp', { isExternal: isExternalBot }),
                pOriginal: ord,
            });
        }
    });

    return result;
}
