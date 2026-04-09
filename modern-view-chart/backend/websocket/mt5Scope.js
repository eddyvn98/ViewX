import { normalizeSymbol } from "./subscriptionIndex.js";

const GLOBAL_SCOPE = "__global__";
const scopedMt5State = new Map();
const scopedMt5Symbols = new Map();

function getScopeId(ownerUserId) {
    return ownerUserId ? `user:${ownerUserId}` : GLOBAL_SCOPE;
}

export function resolveBridgeOwnerUserId(meta) {
    if (!meta?.isBridgeAuthenticated) return null;
    return meta.authType === "user" && meta.userId ? String(meta.userId) : null;
}

export function isRecipientForMt5Owner(meta, ownerUserId) {
    if (!meta || meta.isBridgeAuthenticated) return false;
    if (!ownerUserId) return true;
    return String(meta.userId || "") === String(ownerUserId);
}

export function setScopedMt5Price(mt5Prices, ownerUserId, payload) {
    const symbol = normalizeSymbol(payload?.symbol);
    if (!symbol) return null;
    const scopeId = getScopeId(ownerUserId);
    const key = `${scopeId}|${symbol}`;
    const nextValue = {
        ...payload,
        symbol,
        ownerUserId: ownerUserId || null,
        scopeId,
    };
    mt5Prices.set(key, nextValue);
    return nextValue;
}

export function getScopedMt5Price(mt5Prices, ownerUserId, symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return null;
    return mt5Prices.get(`${getScopeId(ownerUserId)}|${normalized}`) || null;
}

export function getScopedMt5Prices(mt5Prices, ownerUserId) {
    const scopeId = getScopeId(ownerUserId);
    const values = [];
    for (const item of mt5Prices.values()) {
        if (item?.scopeId === scopeId) values.push(item);
    }
    return values;
}

export function setScopedMt5State(ownerUserId, state) {
    scopedMt5State.set(getScopeId(ownerUserId), {
        account: state?.account || {},
        positions: Array.isArray(state?.positions) ? state.positions : [],
        orders: Array.isArray(state?.orders) ? state.orders : [],
    });
}

export function getScopedMt5State(ownerUserId) {
    return scopedMt5State.get(getScopeId(ownerUserId)) || null;
}

export function clearScopedMt5State(ownerUserId) {
    scopedMt5State.delete(getScopeId(ownerUserId));
}

export function setScopedMt5Symbols(ownerUserId, symbols) {
    scopedMt5Symbols.set(getScopeId(ownerUserId), Array.isArray(symbols) ? symbols : []);
}

export function getScopedMt5Symbols(ownerUserId) {
    return scopedMt5Symbols.get(getScopeId(ownerUserId)) || [];
}

export function clearScopedMt5Symbols(ownerUserId) {
    scopedMt5Symbols.delete(getScopeId(ownerUserId));
}

export function clearScopedMt5Prices(mt5Prices, ownerUserId) {
    const scopeId = getScopeId(ownerUserId);
    for (const [key, value] of mt5Prices.entries()) {
        if (value?.scopeId === scopeId || String(key).startsWith(`${scopeId}|`)) {
            mt5Prices.delete(key);
        }
    }
}
