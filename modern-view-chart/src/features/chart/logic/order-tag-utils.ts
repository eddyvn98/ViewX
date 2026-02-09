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

// Helper to normalize symbol names
export const norm = (sym: string | undefined): string =>
    (sym || '').toUpperCase().replace('.M', '').replace('.H', '');

// Generates TagData from Positions
export function getPositionTags(positions: Position[], symbol: string, draggingState: any): TagData[] {
    const targetSymbol = norm(symbol).replace('M', ''); // Ensure correct normalization
    const result: TagData[] = [];

    // Helper to check symbol match more loosely (ignore suffixes like 'm')
    const matches = (s1: string, s2: string) => {
        return s1.replace(/[mM]$/, '') === s2.replace(/[mM]$/, '');
    };

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
    const matches = (s1: string, s2: string) => {
        return s1.replace(/[mM]$/, '') === s2.replace(/[mM]$/, '');
    };

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
    const s1 = draft.symbol.replace(/[mM]$/, '');
    const s2 = symbol.replace(/[mM]$/, '');
    if (s1 !== s2) return [];

    const result: TagData[] = [];
    const entryPrice = draft.isMarket ? (currentPrice || draft.price || 0) : (draft.price || currentPrice || 0);
    const isBuy = draft.type === 'buy';

    // Entry
    if (entryPrice > 0) {
        result.push({
            id: 'draft-entry',
            type: 'draft_entry',
            ticket: 'draft',
            price: entryPrice,
            label: isBuy ? 'BUY DRAFT' : 'SELL DRAFT',
            color: isBuy ? '#3b82f6' : '#ea580c',
            pOriginal: undefined
        });
    }
    // SL
    if (draft.sl > 0) {
        result.push({ id: 'draft-sl', type: 'draft_sl', ticket: 'draft', price: draft.sl, label: 'SL', color: '#ef4444', pOriginal: undefined });
    }
    // TP
    if (draft.tp > 0) {
        result.push({ id: 'draft-tp', type: 'draft_tp', ticket: 'draft', price: draft.tp, label: 'TP', color: '#22c55e', pOriginal: undefined });
    }

    return result;
}
