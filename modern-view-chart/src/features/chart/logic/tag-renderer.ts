import { ISeriesApi } from 'lightweight-charts';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { TagData } from './order-tag-utils';

export interface TagElements {
    el: HTMLElement;
    label: HTMLElement | null;
    pnl: HTMLElement | null;
    price: HTMLElement | null;
    priceBox: HTMLElement | null;
}

export function createTagElement(tag: TagData): TagElements {
    const el = document.createElement('div');
    el.className = "absolute right-0 flex items-center pointer-events-none z-[100] touch-none touch-action-none";
    el.setAttribute('data-tag-id', tag.id);
    el.setAttribute('data-is-tag', 'true');

    if (tag.type === 'draft_group') {
        el.innerHTML = `
            <div class="tag-body flex items-center h-7 gap-1 p-0.5 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-md shadow-[0_4px_24px_rgba(0,0,0,0.4)] pointer-events-auto touch-none touch-action-none transition-all duration-300">
                <div class="cancel-btn h-full w-5 flex items-center justify-center rounded-sm hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all duration-300 [[dragging]_&]:w-0 [[dragging]_&]:opacity-0 [[dragging]_&]:overflow-hidden [[dragging]_&]:p-0" title="Remove" data-no-drag="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-1.5 h-full flex items-center rounded bg-white/5 border border-white/5">
                    <span class="tag-label text-[11px] font-black text-white uppercase tracking-wider"></span>
                </div>
                <div class="tp-btn btn flex items-center justify-center min-w-[28px] h-full px-1.5 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-black border border-emerald-500/20 cursor-pointer hover:bg-emerald-500 hover:text-white transition-all duration-200 uppercase tracking-tighter">TP</div>
                <div class="sl-btn btn flex items-center justify-center min-w-[28px] h-full px-1.5 rounded bg-red-500/10 text-red-400 text-[11px] font-black border border-red-500/20 cursor-pointer hover:bg-red-500 hover:text-white transition-all duration-200 uppercase tracking-tighter">SL</div>
                
                <div class="group-main flex items-center h-full bg-indigo-600 rounded border border-indigo-400 shadow-md overflow-hidden">
                    <div class="lot-container h-full flex items-center bg-black/10">
                        <div class="lot-minus h-full w-5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors active:bg-white/20" title="Decrease Lot" data-no-drag="true">
                            <svg width="8" height="2" viewBox="0 0 24 2" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><line x1="4" y1="1" x2="20" y2="1"></line></svg>
                        </div>
                        <span class="lot-text text-[11px] font-mono font-bold text-white px-1.5 min-w-[35px] text-center select-none">0.01</span>
                        <div class="lot-plus h-full w-5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors active:bg-white/20" title="Increase Lot" data-no-drag="true">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </div>
                    </div>
                    <div class="confirm-btn flex items-center h-full px-3 text-[11px] font-black text-white cursor-pointer hover:bg-white/10 transition-colors active:bg-white/20 uppercase tracking-tight" data-no-drag="true">Confirm</div>
                </div>
            </div>`;
    } else {
        const isDraft = tag.ticket === 'draft';
        el.innerHTML = `
            <div class="tag-body group flex items-center h-7 gap-1 pointer-events-auto cursor-pointer p-0.5 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-all duration-200 touch-none touch-action-none">
                <div class="cancel-btn h-full w-5 flex items-center justify-center rounded-sm hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all duration-300 [[dragging]_&]:w-0 [[dragging]_&]:opacity-0 [[dragging]_&]:overflow-hidden [[dragging]_&]:p-0" title="${isDraft ? 'Remove' : 'Close/Cancel'}" data-no-drag="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-1.5 h-full flex items-center rounded bg-white/5 border border-white/5">
                    <span class="tag-label text-[11px] font-black text-white uppercase tracking-wider"></span>
                </div>
                <span class="pnl-text text-[11px] font-bold px-1 rounded bg-black/40 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out"></span>

                <div class="price-box h-full flex items-center px-2 bg-zinc-900 border border-white/5 rounded-sm min-w-[75px] justify-center cursor-row-resize hover:bg-zinc-800 transition-colors">
                    <span class="price-text text-[11px] font-mono font-bold text-zinc-100"></span>
                </div>
            </div>`;
    }

    const elements: TagElements = {
        el,
        label: el.querySelector('.tag-label') as HTMLElement,
        pnl: el.querySelector('.pnl-text') as HTMLElement,
        price: el.querySelector('.price-text') as HTMLElement,
        priceBox: el.querySelector('.price-box') as HTMLElement
    };

    return elements;
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

    // 1. Common Price Text (Standard for both)
    const pStr = tag.price.toFixed(digits);
    if (elements.price && elements.price.textContent !== pStr) {
        elements.price.textContent = pStr;
    }
    (elements.el as any)._tagData = tag;

    // 2. Draft Group Specific Logic
    if (tag.type === 'draft_group') {
        const draft = tag.pOriginal as any;
        if (!draft) return;

        // Update Label
        if (elements.label && elements.label.textContent !== tag.label) {
            elements.label.textContent = tag.label;
        }
        const labelContainer = elements.el.querySelector('.tag-label-container') as HTMLElement;
        if (labelContainer) {
            labelContainer.style.backgroundColor = `${tag.color}20`; // 12% opacity
            labelContainer.style.borderColor = `${tag.color}40`; // 25% opacity
        }
        if (elements.label) elements.label.style.color = tag.color;

        // Update Lot
        const lotEl = elements.el.querySelector('.lot-text');
        if (lotEl) lotEl.textContent = (draft.volume || 0).toFixed(2);

        // Update TP Button state - Hide if separate tag exists
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

        // Update SL Button state - Hide if separate tag exists
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

        // Color override for main group
        const groupMain = elements.el.querySelector('.group-main') as HTMLElement;
        if (groupMain) {
            groupMain.style.backgroundColor = tag.color;
            groupMain.style.borderColor = 'rgba(255,255,255,0.2)';
        }

        // Color override for price text
        if (elements.price) elements.price.style.color = tag.color;

        return;
    }

    // 3. Standard Tag Logic (Entry, SL, TP of positions/orders)
    if (elements.label && elements.label.textContent !== tag.label) {
        elements.label.textContent = tag.label;
    }

    // Apply accent colors to labels and containers
    const labelContainer = elements.el.querySelector('.tag-label-container') as HTMLElement;
    if (labelContainer) {
        labelContainer.style.backgroundColor = `${tag.color}20`; // 12% opacity
        labelContainer.style.borderColor = `${tag.color}40`; // 25% opacity
    }
    if (elements.label) elements.label.style.color = tag.color;
    if (elements.price) elements.price.style.color = tag.color;

    // PnL Logic
    // Hide PnL for Pending/Draft Entry (if not part of group)
    const isPos = tag.pOriginal && 'open_price' in tag.pOriginal;
    if (!isPos && (tag.type === 'entry' || tag.type === 'draft_entry')) {
        if (elements.pnl) {
            elements.pnl.className = 'hidden';
            elements.pnl.textContent = '';
        }
        return;
    }

    // Calculate PnL
    let pnlVal = 0;
    const isBuy = (tag.pOriginal as any)?.type?.toLowerCase()?.includes('buy') ?? draftOrder?.type === 'buy';

    const op = tag.pOriginal
        ? (('open_price' in tag.pOriginal) ? (tag.pOriginal as any).open_price : (('price_open' in tag.pOriginal) ? (tag.pOriginal as any).price_open : (('price' in tag.pOriginal) ? (tag.pOriginal as any).price : 0)))
        : (draftOrder?.price || currentPrice);

    if (tag.type === 'entry' || tag.type === 'draft_entry') {
        const vol = (tag.pOriginal as any)?.volume || (tag.pOriginal as any)?.amount || draftOrder?.volume || 0;
        pnlVal = calculatePnL({
            type: isBuy ? 'buy' : 'sell',
            openPrice: op,
            currentPrice: currentPrice,
            volume: vol,
            symbolInfo,
            symbol: symbol || symbolInfo?.symbol
        });
    } else {
        const vol = (tag.pOriginal as any)?.volume || (tag.pOriginal as any)?.amount || draftOrder?.volume || 0;
        pnlVal = calculatePnL({
            type: isBuy ? 'buy' : 'sell',
            openPrice: op,
            currentPrice: tag.price,
            volume: vol,
            symbolInfo,
            symbol: symbol || symbolInfo?.symbol
        });
    }

    const pStrFormatted = formatPnL(pnlVal);
    const newClass = `pnl-text text-[10px] font-bold px-1 rounded bg-black/40 ${pnlVal >= 0 ? 'text-green-400' : 'text-red-400'} max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out`;

    if (elements.pnl) {
        if (elements.pnl.className !== newClass) {
            elements.pnl.className = newClass;
        }
        if (elements.pnl.textContent !== pStrFormatted) {
            elements.pnl.textContent = pStrFormatted;
        }
    }
}

export function updateTagPosition(
    elements: TagElements,
    series: ISeriesApi<"Candlestick">,
    price: number
) {
    const y = series.priceToCoordinate(price);
    if (y !== null) {
        elements.el.style.transform = `translateY(${y - 12}px)`;
    }
}
