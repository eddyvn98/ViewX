/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { TagData } from './order-tag-utils';
import { TagElements, TagOriginalMeta, TagRenderContext } from './tag-renderer.types';

function getTagOriginalMeta(tag: TagData, draftOrder: any): TagOriginalMeta {
    return ((tag.pOriginal || draftOrder || {}) as TagOriginalMeta);
}

function updateDraftGroupVisuals(elements: TagElements, tag: TagData) {
    const draft = tag.pOriginal as any;
    if (!draft) return;

    if (elements.label && elements.label.textContent !== tag.label) {
        elements.label.textContent = tag.label;
    }

    const labelContainer = elements.el.querySelector('.tag-label-container') as HTMLElement;
    if (labelContainer) {
        labelContainer.style.backgroundColor = `${tag.color}20`;
        labelContainer.style.borderColor = `${tag.color}40`;
    }

    if (elements.label) elements.label.style.color = tag.color;

    const lotEl = elements.el.querySelector('.lot-text');
    if (lotEl) lotEl.textContent = (draft.volume || 0).toFixed(2);

    const tpBtn = elements.el.querySelector('.tp-btn') as HTMLElement;
    if (tpBtn) {
        const hasTP = (draft.tp || 0) > 0;
        tpBtn.style.display = hasTP ? 'none' : 'flex';
        if (!hasTP) {
            tpBtn.style.opacity = '0.6';
            tpBtn.style.borderStyle = 'dashed';
            tpBtn.style.backgroundColor = 'rgba(0,0,0,0.6)';
            tpBtn.style.color = 'rgba(34, 197, 94, 0.5)';
        }
    }

    const slBtn = elements.el.querySelector('.sl-btn') as HTMLElement;
    if (slBtn) {
        const hasSL = (draft.sl || 0) > 0;
        slBtn.style.display = hasSL ? 'none' : 'flex';
        if (!hasSL) {
            slBtn.style.opacity = '0.6';
            slBtn.style.borderStyle = 'dashed';
            slBtn.style.backgroundColor = 'rgba(0,0,0,0.6)';
            slBtn.style.color = 'rgba(239, 68, 68, 0.5)';
        }
    }

    const confirmBtn = elements.el.querySelector('.confirm-btn') as HTMLElement;
    if (confirmBtn) {
        confirmBtn.style.color = 'white';
        confirmBtn.style.backgroundColor = tag.color;
    }

    if (elements.price) {
        elements.price.style.color = tag.color;
    }
}

function getOpenPrice(original: TagOriginalMeta, draftOrder: any, currentPrice: number) {
    return Number(
        original.open_price ??
        original.price_open ??
        original.entryPrice ??
        original.price ??
        draftOrder?.price ??
        currentPrice
    );
}

function getVolume(original: TagOriginalMeta, draftOrder: any) {
    return Number(
        original.volume ??
        original.amount ??
        original.lotSize ??
        original.quantity ??
        draftOrder?.volume ??
        0
    );
}

function updateDotTagVisuals(elements: TagElements, tag: TagData, context: TagRenderContext) {
    const { currentPrice, draftOrder, symbolInfo, symbol } = context;
    const original = getTagOriginalMeta(tag, draftOrder);
    const isWebStrategy = !!original.strategyId;
    const isExternalBot = Number(original.magic || 0) > 0;
    const isHistory = !!original.isHistorical || original.status === 'closed';
    const isPending = original.status === 'pending';

    const isDotMarker = !!elements.priceBox?.classList.contains('dot-marker');
    if (!isDotMarker || !elements.priceBox) return;

    const pStr = tag.price.toFixed(symbolInfo?.digits || 2);

    elements.priceBox.style.backgroundColor = tag.color;
    elements.priceBox.style.borderColor = `${tag.color}cc`;
    elements.priceBox.style.boxShadow = `0 0 0 1px ${tag.color}55`;

    const sourceCode = isWebStrategy ? 'WEB' : (isExternalBot ? 'EXT' : 'MAN');
    const stateCode = isHistory ? 'HIS' : (isPending ? 'PEND' : 'LIVE');
    const shouldPulse = stateCode === 'LIVE' && tag.type === 'entry' && tag.ticket !== 'draft';

    elements.priceBox.classList.toggle('animate-pulse', shouldPulse);
    if (shouldPulse) {
        elements.priceBox.style.boxShadow = `0 0 0 1px ${tag.color}66, 0 0 10px ${tag.color}99`;
    }

    const cancelBtn = elements.el.querySelector('.cancel-btn') as HTMLElement | null;
    if (cancelBtn && isWebStrategy) {
        cancelBtn.style.display = 'none';
    }

    let caption = `${sourceCode} ${stateCode} ${tag.label} ${pStr}`;
    const typeText = String(original.type || draftOrder?.type || '').toLowerCase();
    const isBuy = typeText.includes('buy');
    const openPrice = getOpenPrice(original, draftOrder, currentPrice);
    const volume = getVolume(original, draftOrder);

    if (tag.type === 'entry' && stateCode === 'LIVE' && openPrice > 0 && volume > 0) {
        const pnlVal = calculatePnL({
            type: isBuy ? 'buy' : 'sell',
            openPrice,
            currentPrice,
            volume,
            symbolInfo,
            symbol: symbol || symbolInfo?.symbol
        });
        caption += ` ${formatPnL(pnlVal)}`;
    }

    const dotCaption = elements.el.querySelector('.dot-caption') as HTMLElement | null;
    if (dotCaption) {
        dotCaption.textContent = caption;
        dotCaption.style.color = `${tag.color}dd`;
    }
}

export function updatePnlVisuals(elements: TagElements, tag: TagData, context: TagRenderContext) {
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

export function updateTagVisuals(
    elements: TagElements,
    tag: TagData,
    symbolInfo: any,
    currentPrice: number,
    draftOrder: any,
    symbol?: string
) {
    const digits = symbolInfo?.digits || 2;
    const pStr = tag.price.toFixed(digits);

    if (elements.price && elements.price.textContent !== pStr) {
        elements.price.textContent = pStr;
    }
    (elements.el as any)._tagData = tag;

    if (tag.type === 'draft_group') {
        updateDraftGroupVisuals(elements, tag);
        return;
    }

    if (elements.label && elements.label.textContent !== tag.label) {
        elements.label.textContent = tag.label;
    }

    const labelContainer = elements.el.querySelector('.tag-label-container') as HTMLElement;
    if (labelContainer) {
        labelContainer.style.backgroundColor = `${tag.color}20`;
        labelContainer.style.borderColor = `${tag.color}40`;
    }
    if (elements.label) elements.label.style.color = tag.color;
    if (elements.price) elements.price.style.color = tag.color;

    const isDotMarker = !!elements.priceBox?.classList.contains('dot-marker');
    const isDraft = tag.ticket === 'draft';
    if (elements.priceBox) {
        elements.priceBox.style.display = (isDraft || isDotMarker) ? 'inline-flex' : 'none';
    }

    const context: TagRenderContext = { symbolInfo, currentPrice, draftOrder, symbol };
    updateDotTagVisuals(elements, tag, context);
    updatePnlVisuals(elements, tag, context);
}

