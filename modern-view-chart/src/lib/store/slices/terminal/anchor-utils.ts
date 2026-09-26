import { Order, Position } from '../../types';

export function toEpochSec(value: any): number | null {
    if (typeof value === 'number' && value > 0) {
        // Handle ms vs s
        return value > 10000000000 ? Math.floor(value / 1000) : value;
    }
    return null;
}

export function withPositionAnchors(current: Position, previous?: Position): Position {
    const nowSec = Math.floor(Date.now() / 1000);
    const next = { ...current };

    // Entry anchor
    if (previous && current.open_price === previous.open_price) {
        next.entry_time = previous.entry_time;
    } else {
        next.entry_time = current.entry_time || nowSec;
    }

    // SL anchor
    if (previous && current.sl === previous.sl) {
        next.sl_time = previous.sl_time;
    } else {
        next.sl_time = current.sl !== 0 ? (current.sl_time || nowSec) : undefined;
    }

    // TP anchor
    if (previous && current.tp === previous.tp) {
        next.tp_time = previous.tp_time;
    } else {
        next.tp_time = current.tp !== 0 ? (current.tp_time || nowSec) : undefined;
    }

    return next;
}

export function withOrderAnchors(current: Order, previous?: Order): Order {
    const nowSec = Math.floor(Date.now() / 1000);
    const next = { ...current };

    // Entry anchor
    if (previous && (current.price_open === previous.price_open)) {
        next.entry_time = previous.entry_time;
    } else {
        const hasFreshEntryTime = previous && current.entry_time && current.entry_time !== previous.entry_time;
        next.entry_time = hasFreshEntryTime ? current.entry_time : (previous ? nowSec : (current.entry_time || current.time || nowSec));
    }

    // SL anchor
    if (previous && current.sl === previous.sl) {
        next.sl_time = previous.sl_time;
    } else {
        next.sl_time = current.sl !== 0 ? (current.sl_time || nowSec) : undefined;
    }

    // TP anchor
    if (previous && current.tp === previous.tp) {
        next.tp_time = previous.tp_time;
    } else {
        next.tp_time = current.tp !== 0 ? (current.tp_time || nowSec) : undefined;
    }

    return next;
}
