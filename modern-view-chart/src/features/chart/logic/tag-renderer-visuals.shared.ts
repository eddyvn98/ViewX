/* eslint-disable @typescript-eslint/no-explicit-any */
import { TagData } from './order-tag-utils';
import { TagOriginalMeta } from './tag-renderer.types';

export function getTagOriginalMeta(tag: TagData, draftOrder: any): TagOriginalMeta {
    return ((tag.pOriginal || draftOrder || {}) as TagOriginalMeta);
}

export function getOpenPrice(original: TagOriginalMeta, draftOrder: any, currentPrice: number) {
    return Number(
        original.open_price ??
        original.price_open ??
        original.entryPrice ??
        original.price ??
        draftOrder?.price ??
        currentPrice
    );
}

export function getVolume(original: TagOriginalMeta, draftOrder: any) {
    return Number(
        original.volume ??
        original.amount ??
        original.lotSize ??
        original.quantity ??
        draftOrder?.volume ??
        0
    );
}
