const pendingHistoryRequests = new Map<string, number>();

export const HISTORY_REQUEST_TIMEOUT_MS = 10_000;

export function buildHistoryRequestKey(
    source: string | undefined,
    symbol: string | undefined,
    interval: string | undefined,
): string {
    return [
        String(source || 'MT5').trim().toUpperCase(),
        String(symbol || '').trim().toUpperCase(),
        String(interval || '').trim(),
    ].join('|');
}

export function tryStartHistoryRequest(
    key: string,
    now = Date.now(),
    timeoutMs = HISTORY_REQUEST_TIMEOUT_MS,
): boolean {
    if (!key) return false;

    const startedAt = pendingHistoryRequests.get(key);
    if (Number.isFinite(startedAt) && now - Number(startedAt) < timeoutMs) {
        return false;
    }

    pendingHistoryRequests.set(key, now);
    return true;
}

export function completeHistoryRequest(key: string): void {
    if (!key) return;
    pendingHistoryRequests.delete(key);
}

export function resetHistoryRequestGate(): void {
    pendingHistoryRequests.clear();
}
