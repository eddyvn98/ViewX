/* eslint-disable @typescript-eslint/no-explicit-any */
import { Position, Order, Alert } from '@/lib/store';
import { VirtualPosition } from '@/features/strategy/types';

// Interface for standardized Tag Data
export interface TagData {
    id: string;        // Unique identifier for caching
    type: string;      // 'entry', 'sl', 'tp', 'alert', 'draft_entry', etc.
    ticket: string | number; // Ticket ID or 'draft'
    price: number;     // Current price level
    anchorTime?: number; // Optional per-tag anchor timestamp (sec or ms)
    label: string;     // Text label (e.g., 'SL', 'TP', 'ORD', 'POS')
    color: string;     // Background color (Tailwind-compatible hex)
    pOriginal?: Position | Order | Alert | VirtualPosition | any; // Original object reference for PnL
}

import { normalizeSymbol } from '@/lib/utils/symbol';

// Helper to normalize symbol names
export const norm = (sym: string | undefined): string => normalizeSymbol(sym);

function resolveEntryColor(opts: { isBuy: boolean; isPending?: boolean; isWeb?: boolean; isExternal?: boolean }): string {
    const { isBuy, isPending, isWeb, isExternal } = opts;
    if (isWeb) {
        if (isPending) return isBuy ? '#f59e0b' : '#f97316';
        return isBuy ? '#22c55e' : '#ef4444';
    }
    if (isExternal) {
        if (isPending) return isBuy ? '#fbbf24' : '#fb7185';
        return isBuy ? '#3b82f6' : '#ec4899';
    }
    if (isPending) return isBuy ? '#f59e0b' : '#fb923c';
    return isBuy ? '#16a34a' : '#dc2626';
}

function resolveLevelColor(level: 'sl' | 'tp', opts: { isWeb?: boolean; isExternal?: boolean }): string {
    const { isWeb, isExternal } = opts;
    if (isWeb) return level === 'sl' ? '#ef4444' : '#22c55e';
    if (isExternal) return level === 'sl' ? '#f43f5e' : '#38bdf8';
    return level === 'sl' ? '#ef4444' : '#22c55e';
}

// Generates TagData from Positions
export function getPositionTags(positions: Position[], symbol: string, draggingState: any): TagData[] {
    const result: TagData[] = [];

    // Helper to check symbol match more loosely (ignore suffixes like 'm')
    const matches = (s1: string, s2: string) => norm(s1) === norm(s2);

    positions.filter(p => matches(p.symbol, symbol)).forEach(pos => {
        let entryPrice = pos.open_price;
        // Apply dragging override if needed
        if (draggingState && draggingState.ticket === pos.ticket && draggingState.type === 'entry') {
            entryPrice = draggingState.price;
        }

        const isBuy = pos.type.toString().toLowerCase().includes('buy');
        const isExternalBot = Number((pos as any).magic || 0) > 0;
        const entryColor = resolveEntryColor({ isBuy, isExternal: isExternalBot });

        // Entry Tag - Differentiate Buy/Sell
        result.push({
            id: `${pos.ticket}-entry`,
            type: 'entry',
            ticket: pos.ticket,
            price: entryPrice,
            anchorTime: pos.entry_time ?? pos.time,
            label: isExternalBot
                ? (isBuy ? 'EXT BOT BUY' : 'EXT BOT SELL')
                : (isBuy ? 'BUY POS' : 'SELL POS'),
            color: entryColor,
            pOriginal: pos
        });

        // SL Tag
        if (pos.sl > 0) {
            let slPrice = pos.sl;
            if (draggingState && draggingState.ticket === pos.ticket && draggingState.type === 'sl') {
                slPrice = draggingState.price;
            }
            result.push({
                id: `${pos.ticket}-sl`,
                type: 'sl',
                ticket: pos.ticket,
                price: slPrice,
                anchorTime: pos.sl_time ?? pos.entry_time ?? pos.time,
                label: 'SL',
                color: resolveLevelColor('sl', { isExternal: isExternalBot }),
                pOriginal: pos
            });
        }

        // TP Tag
        if (pos.tp > 0) {
            let tpPrice = pos.tp;
            if (draggingState && draggingState.ticket === pos.ticket && draggingState.type === 'tp') {
                tpPrice = draggingState.price;
            }
            result.push({
                id: `${pos.ticket}-tp`,
                type: 'tp',
                ticket: pos.ticket,
                price: tpPrice,
                anchorTime: pos.tp_time ?? pos.entry_time ?? pos.time,
                label: 'TP',
                color: resolveLevelColor('tp', { isExternal: isExternalBot }),
                pOriginal: pos
            });
        }
    });

    return result;
}

// Generates TagData from Orders
export function getOrderTags(orders: Order[], symbol: string, draggingState: any): TagData[] {
    // Helper to check symbol match
    const matches = (s1: string, s2: string) => norm(s1) === norm(s2);

    const result: TagData[] = [];

    orders.filter(o => matches(o.symbol, symbol)).forEach(ord => {
        let entryPrice = ord.price_open;
        if (draggingState && draggingState.ticket === ord.ticket && draggingState.type === 'entry') {
            entryPrice = draggingState.price;
        }

        const isBuy = ord.type.toLowerCase().includes('buy');
        const typeLabel = ord.type.toUpperCase().replace(' LIMIT', ' LMT').replace(' STOP', ' STP');
        const isExternalBot = Number((ord as any).magic || 0) > 0;
        const entryColor = resolveEntryColor({ isBuy, isPending: true, isExternal: isExternalBot });

        result.push({
            id: `${ord.ticket}-entry`,
            type: 'entry',
            ticket: ord.ticket,
            price: entryPrice,
            anchorTime: ord.entry_time ?? ord.time,
            label: isExternalBot ? `EXT BOT ${typeLabel}` : typeLabel,
            color: entryColor,
            pOriginal: ord
        });

        // SL / TP Tags
        if (ord.sl > 0) {
            let slPrice = ord.sl;
            if (draggingState && draggingState.ticket === ord.ticket && draggingState.type === 'sl') {
                slPrice = draggingState.price;
            }
            result.push({
                id: `${ord.ticket}-sl`,
                type: 'sl',
                ticket: ord.ticket,
                price: slPrice,
                anchorTime: ord.sl_time ?? ord.entry_time ?? ord.time,
                label: 'SL',
                color: resolveLevelColor('sl', { isExternal: isExternalBot }),
                pOriginal: ord
            });
        }
        if (ord.tp > 0) {
            let tpPrice = ord.tp;
            if (draggingState && draggingState.ticket === ord.ticket && draggingState.type === 'tp') {
                tpPrice = draggingState.price;
            }
            result.push({
                id: `${ord.ticket}-tp`,
                type: 'tp',
                ticket: ord.ticket,
                price: tpPrice,
                anchorTime: ord.tp_time ?? ord.entry_time ?? ord.time,
                label: 'TP',
                color: resolveLevelColor('tp', { isExternal: isExternalBot }),
                pOriginal: ord
            });
        }
    });

    return result;
}

// Generates TagData from Web Strategy Virtual Positions (live only)
export function getVirtualPositionTags(virtualPositions: VirtualPosition[], symbol: string, draggingState: any): TagData[] {
    const matches = (s1: string, s2: string) => norm(s1) === norm(s2);
    const result: TagData[] = [];

    virtualPositions
        .filter(v => matches(v.symbol, symbol) && (v.status === 'open' || v.status === 'pending'))
        .forEach(pos => {
            let entryPrice = pos.entryPrice;
            if (draggingState && draggingState.ticket === `web:${pos.id}` && draggingState.type === 'entry') {
                entryPrice = draggingState.price;
            }

            const isBuy = pos.type === 'BUY';
            const isPending = pos.status === 'pending';
            const entryColor = resolveEntryColor({ isBuy, isPending, isWeb: true });

            result.push({
                id: `web-${pos.id}-entry`,
                type: 'entry',
                ticket: `web:${pos.id}`,
                price: entryPrice,
                anchorTime: pos.entry_time ?? pos.timestamp,
                label: isPending ? `WEB PEND ${pos.type}` : `WEB ${pos.type}`,
                color: entryColor,
                pOriginal: pos as any
            });

            if (pos.sl > 0) {
                let slPrice = pos.sl;
                if (draggingState && draggingState.ticket === `web:${pos.id}` && draggingState.type === 'sl') {
                    slPrice = draggingState.price;
                }
                result.push({
                    id: `web-${pos.id}-sl`,
                    type: 'sl',
                    ticket: `web:${pos.id}`,
                    price: slPrice,
                    anchorTime: pos.sl_time ?? pos.entry_time ?? pos.timestamp,
                    label: 'WEB SL',
                    color: resolveLevelColor('sl', { isWeb: true }),
                    pOriginal: pos as any
                });
            }

            if (pos.tp > 0) {
                let tpPrice = pos.tp;
                if (draggingState && draggingState.ticket === `web:${pos.id}` && draggingState.type === 'tp') {
                    tpPrice = draggingState.price;
                }
                result.push({
                    id: `web-${pos.id}-tp`,
                    type: 'tp',
                    ticket: `web:${pos.id}`,
                    price: tpPrice,
                    anchorTime: pos.tp_time ?? pos.entry_time ?? pos.timestamp,
                    label: 'WEB TP',
                    color: resolveLevelColor('tp', { isWeb: true }),
                    pOriginal: pos as any
                });
            }
        });

    return result;
}

// Generates TagData from Draft Order
export function getDraftTags(draft: any, symbol: string, currentPrice: number): TagData[] {
    if (!draft) return [];

    // Check symbol match
    if (norm(draft.symbol) !== norm(symbol)) return [];

    const result: TagData[] = [];
    const isBuy = draft.type === 'buy';
    const bid = currentPrice || draft.price || 0;
    const ask = bid * 1.0001;
    const entryPrice = draft.isMarket ? (isBuy ? ask : bid) : (draft.price || bid);

    // Unified Draft Group Tag
    if (entryPrice > 0) {
        result.push({
            id: 'draft-group',
            type: 'draft_group',
            ticket: 'draft',
            price: entryPrice,
            label: isBuy ? 'BUY' : 'SELL',
            color: isBuy ? '#10b981' : '#ef4444', // Emerald / Red
            pOriginal: { ...draft, price: entryPrice } as any
        });

        // ⚡ NEW: Separate Tags for SL/TP to allow independent movement
        if (draft.sl > 0) {
            result.push({
                id: 'draft-sl',
                type: 'sl',
                ticket: 'draft',
                price: draft.sl,
                label: 'SL',
                color: '#ef4444',
                pOriginal: draft
            });
        }
        if (draft.tp > 0) {
            result.push({
                id: 'draft-tp',
                type: 'tp',
                ticket: 'draft',
                price: draft.tp,
                label: 'TP',
                color: '#22c55e',
                pOriginal: draft
            });
        }
    }

    return result;
}
