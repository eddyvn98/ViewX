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
    el.className = "absolute right-[120px] flex items-center pointer-events-none touch-none touch-action-none z-20";
    el.setAttribute('data-tag-id', tag.id);
    el.setAttribute('data-is-tag', 'true');

    if (tag.type === 'draft_group') {
        el.innerHTML = `
            <div class="tag-body flex items-center h-8 gap-2 p-1 bg-background/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-border/40 dark:border-white/10 rounded-xl shadow-2xl pointer-events-auto touch-none touch-action-none transition-all duration-300 ring-1 ring-black/5">
                <div class="cancel-btn h-full w-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all duration-300 [[dragging]_&]:w-0 [[dragging]_&]:opacity-0 [[dragging]_&]:overflow-hidden [[dragging]_&]:p-0" title="Remove" data-no-drag="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-2.5 h-full flex items-center rounded-lg bg-secondary/40 dark:bg-white/5 border border-border/10">
                    <span class="tag-label text-[10px] font-black text-foreground uppercase tracking-widest"></span>
                </div>
                
                <div class="tp-btn btn hidden items-center justify-center min-w-[36px] h-full px-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 cursor-pointer hover:bg-emerald-500 hover:text-white transition-all duration-200 uppercase tracking-tight">TP</div>
                <div class="sl-btn btn hidden items-center justify-center min-w-[36px] h-full px-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold border border-red-500/20 cursor-pointer hover:bg-red-500 hover:text-white transition-all duration-200 uppercase tracking-tight">SL</div>
                
                <div class="lot-container flex items-center h-full bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 overflow-hidden shrink-0">
                    <div class="lot-minus h-full w-6 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors active:bg-primary/20 text-primary" title="Decrease Lot" data-no-drag="true">
                        <svg width="10" height="2" viewBox="0 0 24 2" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="4" y1="1" x2="20" y2="1"></line></svg>
                    </div>
                    <span class="lot-text text-[11px] font-bold text-foreground px-2 min-w-[42px] text-center select-none">0.10</span>
                    <div class="lot-plus h-full w-6 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors active:bg-primary/20 text-primary" title="Increase Lot" data-no-drag="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                </div>
                
                <div class="confirm-btn flex items-center justify-center h-full px-2 rounded-lg text-[10px] font-black hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap cursor-pointer shadow-sm" data-no-drag="true">Confirm</div>

                <div class="price-box h-full flex items-center px-3 bg-secondary/50 dark:bg-white/5 border border-border/10 rounded-lg min-w-[85px] justify-center cursor-row-resize hover:bg-secondary/70 transition-colors">
                    <span class="price-text text-[11px] font-bold text-foreground"></span>
                </div>
            </div>`;
    } else if (tag.type === 'alert') {
        el.innerHTML = `
            <div class="absolute right-[100%] top-1/2 w-screen border-b-[1px] border-dashed border-amber-500/40 pointer-events-none"></div>
            <div class="tag-body group flex items-center h-7 gap-1 pointer-events-auto cursor-pointer p-0.5 bg-background/80 backdrop-blur-xl border border-amber-500/20 rounded-lg shadow-ethereal transition-all duration-200 touch-none touch-action-none">
                <div class="cancel-btn h-full w-5 flex items-center justify-center rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all duration-300" title="Remove Alert" data-no-drag="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-1.5 h-full flex items-center justify-center rounded-md bg-amber-500/5 border border-amber-500/10 cursor-grab active:cursor-grabbing" data-draggable="true" data-type="alert" data-ticket="${tag.ticket}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
                </div>
                <div class="price-box h-full flex items-center px-2 bg-secondary/10 border border-amber-500/10 rounded-md min-w-[75px] justify-center cursor-row-resize hover:bg-secondary/20 transition-colors">
                    <span class="price-text text-[11px] font-bold text-amber-500/80"></span>
                </div>
            </div>`;
    } else {
        const isDraft = tag.ticket === 'draft';
        el.innerHTML = `
            <div class="tag-body group flex items-center h-7 gap-1.5 p-0.5 bg-background/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-lg shadow-lg transition-all duration-200 pointer-events-auto cursor-pointer touch-none touch-action-none ring-1 ring-black/5">
                <div class="cancel-btn h-full w-5 flex items-center justify-center rounded hover:bg-red-500/10 text-muted-foreground/60 hover:text-red-500 transition-all duration-300 [[dragging]_&]:w-0 [[dragging]_&]:opacity-0 [[dragging]_&]:overflow-hidden [[dragging]_&]:p-0" title="${isDraft ? 'Remove' : 'Close/Cancel'}" data-no-drag="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-2 h-full flex items-center rounded bg-secondary/30 dark:bg-white/5 border border-border/10">
                    <span class="tag-label text-[10px] font-bold text-foreground uppercase tracking-widest"></span>
                </div>
                <span class="pnl-text text-[10px] font-bold px-1.5 rounded-md bg-secondary/10 dark:bg-black/20 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out"></span>

                <div class="price-box h-full flex items-center px-2 bg-secondary/30 dark:bg-white/5 border border-border/10 rounded min-w-[75px] justify-center cursor-row-resize hover:bg-secondary/50 transition-colors">
                    <span class="price-text text-[12px] font-bold text-foreground/80 dark:text-white/80"></span>
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

        // Confirm button styling
        const confirmBtn = elements.el.querySelector('.confirm-btn') as HTMLElement;
        if (confirmBtn) {
            confirmBtn.style.color = 'white';
            confirmBtn.style.backgroundColor = tag.color; // Solid background but properly contained
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
    const newClass = `pnl-text text-[10px] font-bold px-1.5 rounded-md bg-zinc-500/10 dark:bg-white/10 ${pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out`;

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
