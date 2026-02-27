/* eslint-disable @typescript-eslint/no-explicit-any */
import { IChartApi } from 'lightweight-charts';

export interface TagElements {
    el: HTMLElement;
    label: HTMLElement | null;
    pnl: HTMLElement | null;
    price: HTMLElement | null;
    priceBox: HTMLElement | null;
}

export interface TagRenderContext {
    symbolInfo: any;
    currentPrice: number;
    draftOrder: any;
    symbol?: string;
}

export interface TagPositionContext {
    chart?: IChartApi | null;
    tag?: import('./order-tag-utils').TagData;
    liveAnchorTime?: number;
}

export interface TagOriginalMeta {
    strategyId?: string | number;
    magic?: string | number;
    isHistorical?: boolean;
    status?: string;
    type?: string;
    open_price?: number;
    price_open?: number;
    entryPrice?: number;
    price?: number;
    volume?: number;
    amount?: number;
    lotSize?: number;
    quantity?: number;
    time?: number | string;
    timestamp?: number | string;
    createdAt?: number | string;
    symbol?: string;
}

