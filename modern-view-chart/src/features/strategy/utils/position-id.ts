function createEntropy() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeSegment(value: string | number | undefined) {
    if (value === undefined || value === null) return 'na';
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-');
}

type PositionIdentity = {
    strategyId: string;
    symbol: string;
    timeframe?: string;
    matrixScopeKey?: string;
    openedBarTime?: number;
    type: 'BUY' | 'SELL';
    status: 'open' | 'closed' | 'pending';
    entryPrice: number;
    sl: number;
    tp: number;
    lotSize: number;
};

export function createPositionId(prefix: string, ...parts: Array<string | number | undefined>) {
    const base = [prefix, ...parts.map(sanitizeSegment)].join('-');
    return `${base}-${createEntropy()}`;
}

export function getPositionDedupKey(position: PositionIdentity) {
    return [
        sanitizeSegment(position.strategyId),
        sanitizeSegment(position.symbol),
        sanitizeSegment(position.timeframe),
        sanitizeSegment(position.matrixScopeKey),
        sanitizeSegment(position.openedBarTime),
        sanitizeSegment(position.type),
        sanitizeSegment(position.status),
        sanitizeSegment(position.entryPrice),
        sanitizeSegment(position.sl),
        sanitizeSegment(position.tp),
        sanitizeSegment(position.lotSize),
    ].join('|');
}

export function ensureUniquePositionIds<T extends { id: string }>(positions: T[]) {
    const seen = new Set<string>();

    return positions.map((position, index) => {
        if (!seen.has(position.id)) {
            seen.add(position.id);
            return position;
        }

        const nextId = createPositionId(position.id || 'position', index);
        seen.add(nextId);
        return { ...position, id: nextId };
    });
}
