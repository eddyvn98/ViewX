import { Position, Order } from '../../types';

type ScopedTicket = { ticket: number | string; source?: string };

function sourceOf(item: { source?: string }): string {
    return String(item.source || 'MT5');
}

export function pendingDeletionKey(source: string | undefined, ticket: number | string): string {
    return `${String(source || 'MT5')}:${ticket}`;
}

export function pendingModificationKey(
    source: string | undefined,
    ticket: number | string,
    field: string,
): string {
    return `${pendingDeletionKey(source, ticket)}-${field}`;
}

export function filterPendingDeletions<T extends ScopedTicket>(
    items: T[],
    pendingDeletions: Record<string, number>,
    ttlMs: number,
): T[] {
    const now = Date.now();
    return items.filter((item) => {
        const deletionTime = pendingDeletions[pendingDeletionKey(sourceOf(item), item.ticket)];
        if (!deletionTime) return true;
        return now - deletionTime > ttlMs;
    });
}

export function applyPendingPositionLocks(
    position: Position,
    pendingModifications: Record<string, { price: number; timestamp: number }>,
    ttlMs: number,
): Position {
    const now = Date.now();
    const next = { ...position };
    const apply = (field: 'sl' | 'tp' | 'open_price') => {
        const mod = pendingModifications[
            pendingModificationKey(sourceOf(position), position.ticket, field)
        ];
        if (mod && now - mod.timestamp < ttlMs) next[field] = mod.price;
    };
    apply('sl');
    apply('tp');
    apply('open_price');
    return next;
}

export function applyPendingOrderLocks(
    order: Order,
    pendingModifications: Record<string, { price: number; timestamp: number }>,
    ttlMs: number,
): Order {
    const now = Date.now();
    const next = { ...order };
    const apply = (field: 'sl' | 'tp') => {
        const mod = pendingModifications[
            pendingModificationKey(sourceOf(order), order.ticket, field)
        ];
        if (mod && now - mod.timestamp < ttlMs) next[field] = mod.price;
    };
    apply('sl');
    apply('tp');
    return next;
}

export function hasPositionStructuralChange(prev: Position | undefined, next: Position): boolean {
    if (!prev) return true;
    return (
        prev.sl !== next.sl ||
        prev.tp !== next.tp ||
        prev.open_price !== next.open_price ||
        prev.volume !== next.volume
    );
}

export function patchRealtimePositionFields(prev: Position, next: Position): boolean {
    let changed = false;
    if (prev.profit !== next.profit) {
        prev.profit = next.profit;
        changed = true;
    }
    if (prev.current_price !== next.current_price) {
        prev.current_price = next.current_price;
        changed = true;
    }
    return changed;
}
