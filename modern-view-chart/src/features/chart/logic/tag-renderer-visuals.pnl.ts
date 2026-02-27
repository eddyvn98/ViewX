/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { TagData } from './order-tag-utils';
import { TagElements, TagRenderContext } from './tag-renderer.types';
import { getOpenPrice, getTagOriginalMeta, getVolume } from './tag-renderer-visuals.shared';

export function updatePnlVisuals(elements: TagElements, tag: TagData, context: TagRenderContext) {
    const isDotMarker = !!elements.priceBox?.classList.contains('dot-marker');
    if (isDotMarker) {
        if (elements.pnl) {
            elements.pnl.className = 'hidden';
            elements.pnl.textContent = '';
        }
        return;
    }

    const { currentPrice, draftOrder, symbolInfo, symbol } = context;
    const original = getTagOriginalMeta(tag, draftOrder);
    const isPos = !!tag.pOriginal && (
        'open_price' in (tag.pOriginal as any) ||
        'entryPrice' in (tag.pOriginal as any)
    );

    if (!isPos && (tag.type === 'entry' || tag.type === 'draft_entry')) {
        if (elements.pnl) {
            elements.pnl.className = 'hidden';
            elements.pnl.textContent = '';
        }
        return;
    }

    const isBuy = String(original.type || draftOrder?.type || '').toLowerCase().includes('buy');
    const openPrice = getOpenPrice(original, draftOrder, currentPrice);
    const volume = getVolume(original, draftOrder);

    const pnlVal = calculatePnL({
        type: isBuy ? 'buy' : 'sell',
        openPrice,
        currentPrice: (tag.type === 'entry' || tag.type === 'draft_entry') ? currentPrice : tag.price,
        volume,
        symbolInfo,
        symbol: symbol || symbolInfo?.symbol
    });

    const pnlText = formatPnL(pnlVal);
    const newClass = `pnl-text text-[10px] font-bold px-1.5 rounded-md bg-zinc-500/10 dark:bg-white/10 ${pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out`;

    if (!elements.pnl) return;
    if (elements.pnl.className !== newClass) {
        elements.pnl.className = newClass;
    }
    if (elements.pnl.textContent !== pnlText) {
        elements.pnl.textContent = pnlText;
    }
}
