const isVerboseDebugEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

export function debugLog(...args: unknown[]) {
    if (!isVerboseDebugEnabled) return;
    console.log(...args);
}
