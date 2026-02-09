import { ISeriesApi } from 'lightweight-charts';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { TagData } from './order-tag-utils';

export interface TagElements {
    el: HTMLElement;
    label: HTMLElement;
    pnl: HTMLElement;
    price: HTMLElement;
    priceBox: HTMLElement;
}

export function createTagElement(tag: TagData): TagElements {
    const el = document.createElement('div');
    el.className = "absolute right-0 flex items-center pointer-events-none z-[100]";
    el.setAttribute('data-tag-id', tag.id);

    el.innerHTML = `
        <div class="tag-body group flex items-center h-6 px-2 rounded-l-md shadow-2xl border border-white/10 backdrop-blur-md bg-black/60 pointer-events-auto cursor-pointer transition-all">
            <span class="tag-label text-[10px] font-black text-white mr-2 uppercase"></span>
            <span class="pnl-text text-[10px] font-bold px-1 rounded bg-black/40 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out"></span>
        </div>
        <div class="price-box h-6 flex items-center px-1.5 bg-black text-white text-[10px] font-bold border border-white/20 min-w-[75px] justify-center pointer-events-auto cursor-row-resize hover:bg-white/10 transition-colors">
            <span class="price-text font-mono"></span>
        </div>`;

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
    symbol?: string // Add symbol fallback
) {
    // 1. Label & Color
    if (elements.label.textContent !== tag.label) {
        elements.label.textContent = tag.label;
    }
    elements.priceBox.style.backgroundColor = tag.color;

    // 2. Price Text
    const digits = symbolInfo?.digits || 2;
    const pStr = tag.price.toFixed(digits);
    if (elements.price.textContent !== pStr) {
        elements.price.textContent = pStr;
    }

    // 3. PnL Logic
    // Store tag data on element for drag interactions if needed (legacy support)
    (elements.el as any)._tagData = tag;

    // Hide PnL for Pending/Draft Entry
    const isPos = tag.pOriginal && 'open_price' in tag.pOriginal;
    if (!isPos && (tag.type === 'entry' || tag.type === 'draft_entry')) {
        elements.pnl.className = 'hidden';
        elements.pnl.textContent = '';
        return;
    }

    // Calculate PnL
    let pnlVal = 0;
    const isBuy = tag.pOriginal?.type?.toLowerCase()?.includes('buy') ?? draftOrder?.type === 'buy';

    // Determine Open Price for PnL
    const op = tag.pOriginal
        ? (('open_price' in tag.pOriginal) ? tag.pOriginal.open_price : ('price_open' in tag.pOriginal ? tag.pOriginal.price_open : 0))
        : (draftOrder?.price || currentPrice);

    // Entry PnL vs Projected SL/TP PnL
    if (tag.type === 'entry' || tag.type === 'draft_entry') {
        pnlVal = calculatePnL({
            type: isBuy ? 'buy' : 'sell',
            openPrice: op,
            currentPrice: currentPrice,
            volume: (tag.pOriginal && 'volume' in tag.pOriginal ? tag.pOriginal.volume : 0) || draftOrder?.volume || 0,
            symbolInfo,
            symbol: symbol || symbolInfo?.symbol
        });
    } else {
        pnlVal = calculatePnL({
            type: isBuy ? 'buy' : 'sell',
            openPrice: op,
            currentPrice: tag.price, // Projected price
            volume: (tag.pOriginal && 'volume' in tag.pOriginal ? tag.pOriginal.volume : 0) || draftOrder?.volume || 0,
            symbolInfo,
            symbol: symbol || symbolInfo?.symbol
        });
    }

    const pStrFormatted = formatPnL(pnlVal);
    const newClass = `pnl-text text-[10px] font-bold px-1 rounded bg-black/40 ${pnlVal >= 0 ? 'text-green-400' : 'text-red-400'} max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out`;

    if (elements.pnl.className !== newClass) {
        elements.pnl.className = newClass;
    }
    if (elements.pnl.textContent !== pStrFormatted) {
        elements.pnl.textContent = pStrFormatted;
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
