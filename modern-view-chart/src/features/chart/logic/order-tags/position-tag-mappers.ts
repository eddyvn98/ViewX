/* eslint-disable @typescript-eslint/no-explicit-any */
import { Position } from '@/lib/store';
import { TagData } from './types';
import { norm } from './symbol-utils';
import { resolveEntryColor, resolveLevelColor } from './color-resolvers';

export function getPositionTags(positions: Position[], symbol: string, draggingState: any): TagData[] {
    const result: TagData[] = [];
    const matches = (s1: string, s2: string) => norm(s1) === norm(s2);

    positions.filter(p => matches(p.symbol, symbol)).forEach(pos => {
        let entryPrice = pos.open_price;
        if (draggingState && draggingState.ticket === pos.ticket && draggingState.type === 'entry') entryPrice = draggingState.price;

        const isBuy = pos.type.toString().toLowerCase().includes('buy');
        const isExternalBot = Number((pos as any).magic || 0) > 0;
        const entryColor = resolveEntryColor({ isBuy, isExternal: isExternalBot });

        result.push({
            id: `${pos.ticket}-entry`,
            type: 'entry',
            ticket: pos.ticket,
            price: entryPrice,
            anchorTime: pos.entry_time ?? pos.time,
            label: isExternalBot ? (isBuy ? 'EXT BOT BUY' : 'EXT BOT SELL') : (isBuy ? 'BUY POS' : 'SELL POS'),
            color: entryColor,
            pOriginal: pos,
        });

        if (pos.sl > 0) {
            let slPrice = pos.sl;
            if (draggingState && draggingState.ticket === pos.ticket && draggingState.type === 'sl') slPrice = draggingState.price;
            result.push({
                id: `${pos.ticket}-sl`,
                type: 'sl',
                ticket: pos.ticket,
                price: slPrice,
                anchorTime: pos.sl_time ?? pos.entry_time ?? pos.time,
                label: 'SL',
                color: resolveLevelColor('sl', { isExternal: isExternalBot }),
                pOriginal: pos,
            });
        }

        if (pos.tp > 0) {
            let tpPrice = pos.tp;
            if (draggingState && draggingState.ticket === pos.ticket && draggingState.type === 'tp') tpPrice = draggingState.price;
            result.push({
                id: `${pos.ticket}-tp`,
                type: 'tp',
                ticket: pos.ticket,
                price: tpPrice,
                anchorTime: pos.tp_time ?? pos.entry_time ?? pos.time,
                label: 'TP',
                color: resolveLevelColor('tp', { isExternal: isExternalBot }),
                pOriginal: pos,
            });
        }
    });

    return result;
}
