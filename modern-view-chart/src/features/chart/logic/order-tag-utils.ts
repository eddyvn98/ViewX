import { Position, Order, Alert } from '@/lib/store';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

// Interface for standardized Tag Data
export interface TagData {
    id: string;        // Unique identifier for caching
    type: string;      // 'entry', 'sl', 'tp', 'alert', 'draft_entry', etc.
    ticket: string | number; // Ticket ID or 'draft'
    price: number;     // Current price level
    label: string;     // Text label (e.g., 'SL', 'TP', 'ORD', 'POS')
    color: string;     // Background color (Tailwind-compatible hex)
    pOriginal?: Position | Order | Alert; // Original object reference for PnL
}

import { normalizeSymbol } from '@/lib/utils/symbol';

// Helper to normalize symbol names
export const norm = (sym: string | undefined): string => normalizeSymbol(sym);

// Generates TagData from Positions
export function getPositionTags(positions: Position[], symbol: string, draggingState: any): TagData[] {
    const targetSymbol = norm(symbol).replace('M', ''); // Ensure correct normalization
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

        // Entry Tag - Differentiate Buy/Sell
        result.push({
            id: `${pos.ticket}-entry`,
            type: 'entry',
            ticket: pos.ticket,
            price: entryPrice,
            label: isBuy ? 'BUY POS' : 'SELL POS',
            color: isBuy ? '#3b82f6' : '#ea580c', // Blue for Buy, Orange for Sell
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
                label: 'SL',
                color: '#ef4444',
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
                label: 'TP',
                color: '#22c55e',
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

        result.push({
            id: `${ord.ticket}-entry`,
            type: 'entry',
            ticket: ord.ticket,
            price: entryPrice,
            label: typeLabel,
            color: isBuy ? '#60a5fa' : '#fb923c', // Lighter Blue/Orange for Pending
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
                label: 'SL',
                color: '#ef4444',
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
                label: 'TP',
                color: '#22c55e',
                pOriginal: ord
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
