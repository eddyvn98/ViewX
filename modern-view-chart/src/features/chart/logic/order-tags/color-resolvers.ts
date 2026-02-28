export function resolveEntryColor(opts: { isBuy: boolean; isPending?: boolean; isWeb?: boolean; isExternal?: boolean }): string {
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

export function resolveLevelColor(level: 'sl' | 'tp', opts: { isWeb?: boolean; isExternal?: boolean }): string {
    const { isWeb, isExternal } = opts;
    if (isWeb) return level === 'sl' ? '#ef4444' : '#22c55e';
    if (isExternal) return level === 'sl' ? '#f43f5e' : '#38bdf8';
    return level === 'sl' ? '#ef4444' : '#22c55e';
}
