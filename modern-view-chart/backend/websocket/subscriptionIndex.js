const CORE_SYMBOLS = (process.env.CORE_SYMBOLS || "XAUUSDm,BTCUSDm,ETHUSDm,EURUSDm,GBPUSDm")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function normalizeSymbol(symbol) {
    if (typeof symbol !== "string") return "";
    const trimmed = symbol.trim();
    if (!trimmed) return "";
    if (trimmed.toUpperCase().includes("USDT")) return trimmed.toUpperCase();
    if (/[mM]$/.test(trimmed)) return trimmed.replace(/[mM]$/, "m");
    return trimmed;
}

function clearWsFromIndex(map, ws) {
    for (const [key, set] of map.entries()) {
        set.delete(ws);
        if (set.size === 0) map.delete(key);
    }
}

export function createSubscriptionIndex() {
    return {
        symbolSubscribers: new Map(),
        chartSubscribers: new Map(),
        defaultPriceClients: new Set(),
        coreSymbols: CORE_SYMBOLS.map((s) => normalizeSymbol(s)).filter(Boolean),
    };
}

export function addDefaultPriceClient(index, ws) {
    index.defaultPriceClients.add(ws);
}

export function removeClientFromIndexes(index, ws) {
    index.defaultPriceClients.delete(ws);
    clearWsFromIndex(index.symbolSubscribers, ws);
    clearWsFromIndex(index.chartSubscribers, ws);
}

export function addChartSubscription(index, ws, chartKey) {
    if (!chartKey || typeof chartKey !== "string") return;
    let bucket = index.chartSubscribers.get(chartKey);
    if (!bucket) {
        bucket = new Set();
        index.chartSubscribers.set(chartKey, bucket);
    }
    bucket.add(ws);
}

export function setClientSymbolSubscriptions(index, ws, symbols) {
    for (const [symbol, subscribers] of index.symbolSubscribers.entries()) {
        subscribers.delete(ws);
        if (subscribers.size === 0) index.symbolSubscribers.delete(symbol);
    }

    const normalized = Array.from(new Set((symbols || []).map((s) => normalizeSymbol(s)).filter(Boolean)));
    if (normalized.length === 0) {
        index.defaultPriceClients.add(ws);
        return [];
    }

    index.defaultPriceClients.delete(ws);
    for (const symbol of normalized) {
        let subscribers = index.symbolSubscribers.get(symbol);
        if (!subscribers) {
            subscribers = new Set();
            index.symbolSubscribers.set(symbol, subscribers);
        }
        subscribers.add(ws);
    }

    return normalized;
}

export function collectInterestSymbolsFromIndex(index) {
    const collected = new Set();
    for (const symbol of index.symbolSubscribers.keys()) {
        const normalized = normalizeSymbol(symbol);
        if (normalized) collected.add(normalized);
    }

    for (const key of index.chartSubscribers.keys()) {
        const [symbol] = String(key).split("|");
        const normalized = normalizeSymbol(symbol);
        if (normalized) collected.add(normalized);
    }

    if (collected.size === 0) {
        // No explicit subscriptions and no default viewer clients:
        // tell bridge it can enter idle mode to reduce MT5 polling load.
        if ((index.defaultPriceClients?.size || 0) === 0) return [];
        return [...index.coreSymbols];
    }
    return Array.from(collected);
}
