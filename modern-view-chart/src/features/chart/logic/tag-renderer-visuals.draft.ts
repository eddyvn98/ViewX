/* eslint-disable @typescript-eslint/no-explicit-any */
import { TagData } from './order-tag-utils';
import { TagElements } from './tag-renderer.types';

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
