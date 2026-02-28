/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { TagData } from './order-tag-utils';
import { TagElements, TagRenderContext } from './tag-renderer.types';
import { getOpenPrice, getTagOriginalMeta, getVolume } from './tag-renderer-visuals.shared';

const DOT_BREATHE_STYLE_ID = 'mvx-dot-breathe-style';
const UNIFIED_DOT_SIZE_PX = 8;

function ensureDotBreatheStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(DOT_BREATHE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = DOT_BREATHE_STYLE_ID;
    style.textContent = `
@keyframes mvx-dot-breathe {
  0%, 100% { transform: scale(1); opacity: 0.92; }
  50% { transform: scale(1); opacity: 1; }
}`;
    document.head.appendChild(style);
}

export function updateDotTagVisuals(elements: TagElements, tag: TagData, context: TagRenderContext) {
    const { currentPrice, draftOrder, symbolInfo, symbol } = context;
    const original = getTagOriginalMeta(tag, draftOrder);
    const isWebStrategy = !!original.strategyId;
    const isHistory = !!original.isHistorical || original.status === 'closed';
    const isLiveDot = !isHistory && tag.ticket !== 'draft';

    const isDotMarker = !!elements.priceBox?.classList.contains('dot-marker');
    if (!isDotMarker || !elements.priceBox) return;
    // Hard-disable legacy arrow overlay on dot tags.
    // Existing DOM nodes can be reused across updates, so proactively remove stale arrow artifacts.
    elements.priceBox.classList.remove('arrow-marker');
    elements.priceBox.classList.remove('h-4', 'w-4', 'min-w-[16px]', 'rounded-none', 'border-0', 'bg-transparent', 'ring-0');
    elements.priceBox.classList.add('h-3', 'w-3', 'min-w-[12px]', 'rounded-full', 'border-2', 'ring-1');
    const shouldRenderAsArrow = false;

    const pStr = tag.price.toFixed(symbolInfo?.digits || 2);

    ensureDotBreatheStyles();

    if (!shouldRenderAsArrow) {
        elements.priceBox.style.width = `${UNIFIED_DOT_SIZE_PX}px`;
        elements.priceBox.style.height = `${UNIFIED_DOT_SIZE_PX}px`;
        elements.priceBox.style.minWidth = `${UNIFIED_DOT_SIZE_PX}px`;
        elements.priceBox.style.borderWidth = '1px';
        elements.priceBox.style.backgroundColor = tag.color;
        elements.priceBox.style.borderColor = `${tag.color}cc`;
        elements.priceBox.style.boxShadow = `0 0 0 1px ${tag.color}55`;
        elements.priceBox.style.borderRadius = '9999px';
    } else {
        elements.priceBox.style.width = '16px';
        elements.priceBox.style.height = '16px';
        elements.priceBox.style.minWidth = '16px';
        elements.priceBox.style.borderWidth = '0';
        elements.priceBox.style.backgroundColor = 'transparent';
        elements.priceBox.style.borderColor = 'transparent';
        elements.priceBox.style.boxShadow = 'none';
        elements.priceBox.style.borderRadius = '0';
    }

    const shouldPulse = isLiveDot;

    elements.priceBox.classList.remove('animate-pulse');
    const nextAnimation = shouldPulse ? 'mvx-dot-breathe 3.2s ease-in-out infinite' : '';
    if (elements.priceBox.style.animation !== nextAnimation) {
        elements.priceBox.style.animation = nextAnimation;
    }
    if (shouldPulse && !shouldRenderAsArrow) {
        elements.priceBox.style.boxShadow = `0 0 0 1px ${tag.color}66, 0 0 4px ${tag.color}55`;
    }

    const arrowGlyph = elements.el.querySelector('.arrow-glyph') as HTMLElement | null;
    if (arrowGlyph) {
        arrowGlyph.remove();
    }

    const tagBody = elements.el.querySelector('.tag-body') as HTMLElement | null;
    if (tagBody) {
        if (isLiveDot) {
            tagBody.style.backgroundColor = 'transparent';
            tagBody.style.borderColor = 'transparent';
            tagBody.style.boxShadow = 'none';
            tagBody.style.padding = '0';
            tagBody.style.gap = '0';
        } else {
            tagBody.style.backgroundColor = '';
            tagBody.style.borderColor = '';
            tagBody.style.boxShadow = '';
            tagBody.style.padding = '';
            tagBody.style.gap = '';
        }
    }

    const cancelBtn = elements.el.querySelector('.cancel-btn') as HTMLElement | null;
    if (cancelBtn) {
        cancelBtn.style.display = isLiveDot || isWebStrategy ? 'none' : '';
    }

    const typeText = String(original.type || draftOrder?.type || '').toLowerCase();
    const isBuy = typeText.includes('buy');
    const openPrice = getOpenPrice(original, draftOrder, currentPrice);
    const volume = getVolume(original, draftOrder);
    let entryPnlText = '';

    if (tag.type === 'entry' && isLiveDot && openPrice > 0 && volume > 0) {
        const pnlVal = calculatePnL({
            type: isBuy ? 'buy' : 'sell',
            openPrice,
            currentPrice,
            volume,
            symbolInfo,
            symbol: symbol || symbolInfo?.symbol
        });
        entryPnlText = formatPnL(pnlVal);
    }

    const dotCaption = elements.el.querySelector('.dot-caption') as HTMLElement | null;
    if (dotCaption) {
        if (isLiveDot) {
            if (tag.type === 'entry') {
                dotCaption.textContent = entryPnlText ? `E ${pStr} ${entryPnlText}` : `E ${pStr}`;
            } else if (tag.type === 'sl') {
                dotCaption.textContent = `SL ${pStr}`;
            } else if (tag.type === 'tp') {
                dotCaption.textContent = `TP ${pStr}`;
            } else {
                dotCaption.textContent = pStr;
            }
            dotCaption.style.color = `${tag.color}dd`;
            dotCaption.style.display = '';
            dotCaption.style.fontSize = '8px';
            dotCaption.style.fontWeight = '600';
            dotCaption.style.letterSpacing = '0.01em';
            dotCaption.style.whiteSpace = 'nowrap';
        } else {
            dotCaption.textContent = '';
            dotCaption.style.display = 'none';
        }
    }
}
