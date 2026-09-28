/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMarketStore } from '@/lib/store';
import { dispatchTagRemoveAction } from '../../logic/tag-command-dispatcher';
import { TagData } from '../../logic/order-tag-utils';
import { TagElements } from '../../logic/tag-renderer';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { buildMt5WriteFields, type Mt5TradingIdentity } from '@/lib/mt5/trading-request';

function setupDraftGroupInteractions(elements: TagElements, sendMessage?: (data: any) => void, identity?: Mt5TradingIdentity) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
        useMarketStore.getState().setDraftOrder(null);
    });

    elements.el.querySelector('.lot-minus')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        const { draftOrder, setDraftOrder } = useMarketStore.getState();
        if (draftOrder) {
            const newVal = Math.max(0.01, (draftOrder.volume || 0.01) - 0.01);
            setDraftOrder({ ...draftOrder, volume: newVal });
        }
    });

    elements.el.querySelector('.lot-plus')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        const { draftOrder, setDraftOrder } = useMarketStore.getState();
        if (draftOrder) {
            const newVal = (draftOrder.volume || 0.01) + 0.01;
            setDraftOrder({ ...draftOrder, volume: newVal });
        }
    });

    const lotBox = elements.el.querySelector('.lot-container') as HTMLElement;
    if (lotBox) {
        lotBox.setAttribute('data-draggable', 'true');
        lotBox.setAttribute('data-type', 'entry');
        lotBox.setAttribute('data-ticket', 'draft');
    }

    const tpBtn = elements.el.querySelector('.tp-btn') as HTMLElement;
    if (tpBtn) {
        tpBtn.setAttribute('data-draggable', 'true');
        tpBtn.setAttribute('data-type', 'tp');
        tpBtn.setAttribute('data-ticket', 'draft');
    }

    const slBtn = elements.el.querySelector('.sl-btn') as HTMLElement;
    if (slBtn) {
        slBtn.setAttribute('data-draggable', 'true');
        slBtn.setAttribute('data-type', 'sl');
        slBtn.setAttribute('data-ticket', 'draft');
    }

    const priceBox = elements.el.querySelector('.price-box') as HTMLElement;
    if (priceBox) {
        priceBox.setAttribute('data-draggable', 'true');
        priceBox.setAttribute('data-type', 'entry');
        priceBox.setAttribute('data-ticket', 'draft');
    }

    const tagBody = elements.el.querySelector('.tag-body') as HTMLElement;
    if (tagBody) {
        tagBody.setAttribute('data-draggable', 'true');
        tagBody.setAttribute('data-type', 'entry');
        tagBody.setAttribute('data-ticket', 'draft');
    }

    elements.el.querySelector('.confirm-btn')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();

        const store = useMarketStore.getState() as any;
        const draft = store.draftOrder;
        if (!draft) return;

        const normSym = normalizeSymbol(draft.symbol);
        const digits = store.symbolInfo?.[normSym]?.digits || 5;
        const currentPrice = store.tickers?.[normSym]?.price || draft.price || 0;
        const entryPrice = draft.isMarket ? currentPrice : (draft.price || currentPrice);
        const isBuy = String(draft.type).toLowerCase() === 'buy';

        if (draft.sl && draft.sl > 0) {
            if ((isBuy && draft.sl >= entryPrice) || (!isBuy && draft.sl <= entryPrice)) return;
        }
        if (draft.tp && draft.tp > 0) {
            if ((isBuy && draft.tp <= entryPrice) || (!isBuy && draft.tp >= entryPrice)) return;
        }

        const payload: any = {
            topic: 'mt5_command',
            command: 'order',
            symbol: draft.symbol,
            type: draft.type,
            volume: draft.volume,
            is_market: draft.isMarket,
            price: draft.isMarket ? 0 : Number((draft.price ?? 0).toFixed(digits)),
            ...buildMt5WriteFields(identity),
        };

        if (draft.sl && draft.sl > 0) payload.sl = Number(draft.sl.toFixed(digits));
        if (draft.tp && draft.tp > 0) payload.tp = Number(draft.tp.toFixed(digits));

        if (sendMessage) sendMessage(payload);
        else store.sendMessage?.(payload);

        store.setDraftOrder(null);
    });
}

function setupDraftTagInteractions(elements: TagElements, tag: TagData) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
        const { draftOrder, setDraftOrder } = useMarketStore.getState();
        if (!draftOrder) return;

        const field = tag.type.includes('sl') ? 'sl' : 'tp';
        setDraftOrder({ ...draftOrder, [field]: 0, [`${field}Touched`]: false });
    });

    if (elements.priceBox) {
        elements.priceBox.setAttribute('data-draggable', 'true');
        elements.priceBox.setAttribute('data-type', tag.type);
        elements.priceBox.setAttribute('data-ticket', 'draft');
    }

    const tagBody = elements.el.querySelector('.tag-body') as HTMLElement;
    if (tagBody) {
        tagBody.setAttribute('data-draggable', 'true');
        tagBody.setAttribute('data-type', tag.type);
        tagBody.setAttribute('data-ticket', 'draft');
    }
}

function setupRealTagInteractions(elements: TagElements, tag: TagData, sendMessage?: (data: any) => void, identity?: Mt5TradingIdentity) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        dispatchTagRemoveAction({ ticket: tag.ticket, type: tag.type }, sendMessage, identity);
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
    });
}

export function setupTagInteractions(elements: TagElements, tag: TagData, sendMessage?: (data: any) => void, identity?: Mt5TradingIdentity) {
    if (tag.type === 'draft_group') {
        setupDraftGroupInteractions(elements, sendMessage, identity);
        return;
    }

    if (tag.ticket === 'draft') {
        setupDraftTagInteractions(elements, tag);
        return;
    }

    setupRealTagInteractions(elements, tag, sendMessage, identity);
}
