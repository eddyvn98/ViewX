import { TagData } from './order-tag-utils';
import { TagElements } from './tag-renderer.types';

function createElementsFromHtml(tag: TagData, innerHtml: string): TagElements {
    const el = document.createElement('div');
    el.className = 'absolute right-[120px] flex items-center pointer-events-none touch-none touch-action-none z-20';
    el.setAttribute('data-tag-id', tag.id);
    el.setAttribute('data-is-tag', 'true');
    el.innerHTML = innerHtml;

    return {
        el,
        label: el.querySelector('.tag-label') as HTMLElement,
        pnl: el.querySelector('.pnl-text') as HTMLElement,
        price: el.querySelector('.price-text') as HTMLElement,
        priceBox: el.querySelector('.price-box') as HTMLElement
    };
}

function createDraftGroupTagElement(tag: TagData): TagElements {
    return createElementsFromHtml(tag, `
            <div class="tag-body flex items-center h-8 gap-2 p-1 bg-background/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-border/40 dark:border-white/10 rounded-xl shadow-2xl pointer-events-auto touch-none touch-action-none transition-all duration-300 ring-1 ring-black/5"
                data-draggable="true" data-type="entry" data-ticket="draft">
                <div class="cancel-btn h-full w-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all duration-300 [[dragging]_&]:w-0 [[dragging]_&]:opacity-0 [[dragging]_&]:overflow-hidden [[dragging]_&]:p-0" title="Remove" data-no-drag="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-2.5 h-full flex items-center rounded-lg bg-secondary/40 dark:bg-white/5 border border-border/10">
                    <span class="tag-label text-[11px] font-black text-foreground uppercase tracking-widest"></span>
                </div>

                <div class="lot-container flex items-center h-full bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 overflow-hidden shrink-0">
                    <div class="lot-minus h-full w-6 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors active:bg-primary/20 text-primary" title="Decrease Lot" data-no-drag="true">
                        <svg width="10" height="2" viewBox="0 0 24 2" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="4" y1="1" x2="20" y2="1"></line></svg>
                    </div>
                    <span class="lot-text text-[11px] font-bold text-foreground px-2 min-w-[42px] text-center select-none">0.10</span>
                    <div class="lot-plus h-full w-6 flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors active:bg-primary/20 text-primary" title="Increase Lot" data-no-drag="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                </div>

                <div class="sl-btn btn hidden items-center justify-center min-w-[36px] h-full px-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold border border-red-500/20 cursor-pointer hover:bg-red-500 hover:text-white transition-all duration-200 uppercase tracking-tight"
                    data-draggable="true" data-type="sl" data-ticket="draft">SL</div>
                <div class="tp-btn btn hidden items-center justify-center min-w-[36px] h-full px-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 cursor-pointer hover:bg-emerald-500 hover:text-white transition-all duration-200 uppercase tracking-tight"
                    data-draggable="true" data-type="tp" data-ticket="draft">TP</div>

                <div class="confirm-btn flex items-center justify-center h-full px-2 rounded-lg text-[11px] font-black hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest whitespace-nowrap cursor-pointer shadow-sm" data-no-drag="true">Confirm</div>

                <div class="price-box h-full flex items-center px-3 bg-secondary/50 dark:bg-white/5 border border-border/10 rounded-lg min-w-[85px] justify-center cursor-row-resize hover:bg-secondary/70 transition-colors"
                    data-draggable="true" data-type="entry" data-ticket="draft">
                    <span class="price-text text-[11px] font-bold text-foreground"></span>
                </div>
            </div>`);
}

function createDraftLevelTagElement(tag: TagData): TagElements {
    return createElementsFromHtml(tag, `
            <div class="absolute right-[100%] top-1/2 w-screen border-b-[1px] border-dashed pointer-events-none draft-level-line"></div>
            <div class="tag-body group flex items-center h-7 gap-1 px-1.5 bg-background/85 backdrop-blur-xl border rounded-lg shadow-lg pointer-events-auto touch-none touch-action-none"
                data-draggable="true" data-type="${tag.type}" data-ticket="draft">
                <span class="tag-label text-[10px] font-bold uppercase tracking-wide"></span>
                <span class="lot-text text-[10px] font-semibold text-foreground/80">0.00</span>
                <span class="pnl-text text-[11px] font-bold tracking-tight"></span>
                <div class="cancel-btn h-5 w-5 flex items-center justify-center rounded-md hover:bg-red-500/15 text-muted-foreground hover:text-red-500 transition-all duration-200" title="Remove" data-no-drag="true">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <span class="price-text hidden"></span>
                <div class="price-box hidden"></div>
            </div>`);
}

function createAlertTagElement(tag: TagData): TagElements {
    return createElementsFromHtml(tag, `
            <div class="absolute right-[100%] top-1/2 w-screen border-b-[1px] border-dashed border-amber-500/40 pointer-events-none"></div>
            <div class="tag-body group flex items-center h-7 gap-1 pointer-events-auto cursor-pointer p-0.5 bg-background/80 backdrop-blur-xl border border-amber-500/20 rounded-lg shadow-ethereal transition-all duration-200 touch-none touch-action-none"
                data-draggable="true" data-type="alert" data-ticket="${tag.ticket}">
                <div class="cancel-btn h-full w-5 flex items-center justify-center rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all duration-300" title="Remove Alert" data-no-drag="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="tag-label-container px-1.5 h-full flex items-center justify-center rounded-md bg-amber-500/5 border border-amber-500/10 cursor-grab active:cursor-grabbing" data-draggable="true" data-type="alert" data-ticket="${tag.ticket}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
                </div>
                <div class="price-box h-full flex items-center px-2 bg-secondary/10 border border-amber-500/10 rounded-md min-w-[75px] justify-center cursor-row-resize hover:bg-secondary/20 transition-colors"
                    data-draggable="true" data-type="alert" data-ticket="${tag.ticket}">
                    <span class="price-text text-[11px] font-bold text-amber-500/80"></span>
                </div>
            </div>`);
}

function createDotTagElement(tag: TagData): TagElements {
    const isReadOnlyWebTag = typeof tag.ticket === 'string' && tag.ticket.startsWith('web:');
    const draggableAttr = isReadOnlyWebTag
        ? ''
        : `data-draggable="true" data-type="${tag.type}" data-ticket="${tag.ticket}"`;
    const markerClass = 'dot-marker';
    const markerShapeClass = 'h-3 w-3 min-w-[12px] rounded-full border-2 border-white/40 bg-secondary/70 ring-1 ring-black/30';
    const isDraft = tag.ticket === 'draft';
    const cancelClass = isReadOnlyWebTag
        ? 'hidden'
        : 'h-4 w-4 flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 [[dragging]_&]:hidden';

    return createElementsFromHtml(tag, `
            <div class="tag-body group flex items-center h-5 gap-1 px-1 rounded-full bg-background/25 border border-border/20 shadow-sm transition-all duration-200 pointer-events-auto cursor-pointer touch-none touch-action-none">
                <div class="cancel-btn ${cancelClass}" title="${isDraft ? 'Remove' : 'Close/Cancel'}" data-no-drag="true">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="price-box ${markerClass} ${markerShapeClass} p-0 justify-center items-center cursor-row-resize transition-transform duration-150 group-hover:scale-110" ${draggableAttr}>
                    <span class="price-text hidden"></span>
                </div>
                <span class="dot-caption text-[11px] font-semibold leading-none text-foreground/75 tracking-tight"></span>
                <span class="tag-label hidden"></span>
                <span class="pnl-text hidden"></span>
            </div>`);
}

export function createTagElement(tag: TagData): TagElements {
    if (tag.type === 'draft_group') return createDraftGroupTagElement(tag);
    if (tag.ticket === 'draft' && (tag.type === 'sl' || tag.type === 'tp')) return createDraftLevelTagElement(tag);
    if (tag.type === 'alert') return createAlertTagElement(tag);
    return createDotTagElement(tag);
}

