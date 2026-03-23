/* eslint-disable @typescript-eslint/no-explicit-any */
import { TagData } from './order-tag-utils';
import { TagElements, TagRenderContext } from './tag-renderer.types';
import { updateDraftGroupVisuals, updateDraftLevelVisuals } from './tag-renderer-visuals.draft';
import { updateDotTagVisuals } from './tag-renderer-visuals.dot';
import { updatePnlVisuals } from './tag-renderer-visuals.pnl';

export { updatePnlVisuals } from './tag-renderer-visuals.pnl';

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

    if (tag.ticket === 'draft' && (tag.type === 'sl' || tag.type === 'tp')) {
        const context: TagRenderContext = { symbolInfo, currentPrice, draftOrder, symbol };
        updateDraftLevelVisuals(elements, tag, context);
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
