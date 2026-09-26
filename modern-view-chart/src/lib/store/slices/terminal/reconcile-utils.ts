import { Position, Order } from '../../types';

export function filterPendingDeletions<T extends { ticket: number | string }>(
    items: T[],
    pendingDeletions: Record<number, number>,
    ttlMs: number
): T[] {
    const now = Date.now();
    return items.filter((item) => {
        const ticket = Number(item.ticket);
        const deletionTime = pendingDeletions[ticket];
        if (!deletionTime) return true;
        // Keep if TTL expired
        return now - deletionTime > ttlMs;
    });
}

export function applyPendingPositionLocks(
    position: Position,
    pendingModifications: Record<string, any>,
    ttlMs: number
): Position {
    const now = Date.now();
    const next = { ...position };

    const slKey = `${position.ticket}-sl`;
    const slMod = pendingModifications[slKey];
    if (slMod && now - slMod.timestamp < ttlMs) {
        next.sl = slMod.price;
    }

    const tpKey = `${position.ticket}-tp`;
    const tpMod = pendingModifications[tpKey];
    if (tpMod && now - tpMod.timestamp < ttlMs) {
        next.tp = tpMod.price;
    }

    const openKey = `${position.ticket}-open_price`;
    const openMod = pendingModifications[openKey];
    if (openMod && now - openMod.timestamp < ttlMs) {
        next.open_price = openMod.price;
    }

    return next;
}

export function applyPendingOrderLocks(
    order: Order,
    pendingModifications: Record<string, any>,
    ttlMs: number
): Order {
    const now = Date.now();
    const next = { ...order };

    const slKey = `${order.ticket}-sl`;
    const slMod = pendingModifications[slKey];
    if (slMod && now - slMod.timestamp < ttlMs) {
        next.sl = slMod.price;
    }

    const tpKey = `${order.ticket}-tp`;
    const tpMod = pendingModifications[tpKey];
    if (tpMod && now - tpMod.timestamp < ttlMs) {
        next.tp = tpMod.price;
    }

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
