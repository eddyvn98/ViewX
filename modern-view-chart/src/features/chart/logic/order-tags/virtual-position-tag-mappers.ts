/* eslint-disable @typescript-eslint/no-explicit-any */
import { VirtualPosition } from '@/features/strategy/types';
import { TagData } from './types';
import { norm } from './symbol-utils';
import { resolveEntryColor, resolveLevelColor } from './color-resolvers';

export function getVirtualPositionTags(virtualPositions: VirtualPosition[], symbol: string, draggingState: any): TagData[] {
    const matches = (s1: string, s2: string) => norm(s1) === norm(s2);
    const result: TagData[] = [];

    virtualPositions
        .filter(v => matches(v.symbol, symbol) && (v.status === 'open' || v.status === 'pending'))
        .forEach(pos => {
            let entryPrice = pos.entryPrice;
            if (draggingState && draggingState.ticket === `web:${pos.id}` && draggingState.type === 'entry') entryPrice = draggingState.price;

            const isBuy = pos.type === 'BUY';
            const isPending = pos.status === 'pending';
            const entryColor = resolveEntryColor({ isBuy, isPending, isWeb: true });

            result.push({
                id: `web-${pos.id}-entry`,
                type: 'entry',
                ticket: `web:${pos.id}`,
                price: entryPrice,
                anchorTime: pos.entry_time ?? pos.timestamp,
                label: isPending ? `WEB PEND ${pos.type}` : `WEB ${pos.type}`,
                color: entryColor,
                pOriginal: pos as any,
            });

            if (pos.sl > 0) {
                let slPrice = pos.sl;
                if (draggingState && draggingState.ticket === `web:${pos.id}` && draggingState.type === 'sl') slPrice = draggingState.price;
                result.push({
                    id: `web-${pos.id}-sl`,
                    type: 'sl',
                    ticket: `web:${pos.id}`,
                    price: slPrice,
                    anchorTime: pos.sl_time ?? pos.entry_time ?? pos.timestamp,
                    label: 'WEB SL',
                    color: resolveLevelColor('sl', { isWeb: true }),
                    pOriginal: pos as any,
                });
            }

            if (pos.tp > 0) {
                let tpPrice = pos.tp;
                if (draggingState && draggingState.ticket === `web:${pos.id}` && draggingState.type === 'tp') tpPrice = draggingState.price;
                result.push({
                    id: `web-${pos.id}-tp`,
                    type: 'tp',
                    ticket: `web:${pos.id}`,
                    price: tpPrice,
                    anchorTime: pos.tp_time ?? pos.entry_time ?? pos.timestamp,
                    label: 'WEB TP',
                    color: resolveLevelColor('tp', { isWeb: true }),
                    pOriginal: pos as any,
                });
            }
        });

    return result;
}
