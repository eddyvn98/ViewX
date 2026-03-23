/* eslint-disable @typescript-eslint/no-explicit-any */
import { TagData } from './order-tag-utils';
import { TagElements } from './tag-renderer.types';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

export function updateDraftGroupVisuals(elements: TagElements, tag: TagData) {
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

export function updateDraftLevelVisuals(
    elements: TagElements,
    tag: TagData,
    context: { symbolInfo?: any; draftOrder?: any; symbol?: string; currentPrice?: number }
) {
    const draft = (tag.pOriginal || context.draftOrder || {}) as any;
    const labelEl = elements.el.querySelector('.tag-label') as HTMLElement | null;
    const lotEl = elements.el.querySelector('.lot-text') as HTMLElement | null;
    const pnlEl = elements.el.querySelector('.pnl-text') as HTMLElement | null;
    const line = elements.el.querySelector('.draft-level-line') as HTMLElement | null;
    const body = elements.el.querySelector('.tag-body') as HTMLElement | null;

    const isTP = tag.type === 'tp';
    const accent = isTP ? '#10b981' : '#f59e0b';
    const side = String(draft.type || 'buy').toLowerCase().includes('buy') ? 'buy' : 'sell';
    const openPrice = Number(draft.price || context.currentPrice || 0);
    const volume = Number(draft.volume || 0.01);

    const pnlValue = calculatePnL({
        type: side,
        openPrice,
        currentPrice: Number(tag.price || 0),
        volume,
        symbolInfo: context.symbolInfo,
        symbol: context.symbol,
    });

    if (labelEl) {
        labelEl.textContent = isTP ? 'TP' : 'SL';
        labelEl.style.color = accent;
    }
    if (lotEl) lotEl.textContent = volume.toFixed(2);
    if (pnlEl) {
        pnlEl.textContent = formatPnL(pnlValue);
        pnlEl.style.color = pnlValue >= 0 ? '#10b981' : '#ef4444';
    }
    if (line) line.style.borderColor = `${accent}66`;
    if (body) {
        body.style.borderColor = `${accent}4a`;
        body.style.backgroundColor = `${accent}12`;
    }
}
