export function getAvailableMt5Symbol(item: unknown): string {
    if (typeof item === 'string') return item.trim();
    if (!item || typeof item !== 'object' || !('symbol' in item)) return '';
    return String(item.symbol || '').trim();
}
