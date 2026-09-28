import { normalizeSymbol } from "./subscriptionIndex.js";

const GLOBAL_SCOPE = "__global__";
const DEFAULT_ACCOUNT = "__default_account__";
const DEFAULT_TERMINAL = "__default_terminal__";

const scopedMt5State = new Map();
const scopedMt5Symbols = new Map();

function normalizeOptional(value) {
    const text = String(value || "").trim();
    return text || null;
}

export function createMt5Scope({
    ownerUserId = null,
    accountLogin = null,
    terminalId = null,
    broker = null,
    source = null,
} = {}) {
    const normalizedOwner = normalizeOptional(ownerUserId);
    const normalizedAccount = normalizeOptional(accountLogin);
    const normalizedTerminal = normalizeOptional(terminalId);
    const normalizedBroker = normalizeOptional(broker);
    const isPersonal = Boolean(normalizedOwner && normalizedAccount);
    const normalizedSource = source || (isPersonal ? "MT5_PERSONAL" : "MT5");

    const scopeId = isPersonal
        ? [
            `user:${normalizedOwner}`,
            `account:${normalizedAccount || DEFAULT_ACCOUNT}`,
            `terminal:${normalizedTerminal || DEFAULT_TERMINAL}`,
        ].join("|")
        : normalizedOwner
            ? `user:${normalizedOwner}`
            : GLOBAL_SCOPE;

    return {
        scopeId,
        ownerUserId: normalizedOwner,
        accountLogin: normalizedAccount,
        terminalId: normalizedTerminal,
        broker: normalizedBroker,
        source: normalizedSource,
        isPersonal,
    };
}

function normalizeScope(scopeOrOwnerUserId = null) {
    if (scopeOrOwnerUserId && typeof scopeOrOwnerUserId === "object") {
        if (scopeOrOwnerUserId.scopeId) {
            return {
                ...createMt5Scope(scopeOrOwnerUserId),
                scopeId: String(scopeOrOwnerUserId.scopeId),
            };
        }
        return createMt5Scope(scopeOrOwnerUserId);
    }
    return createMt5Scope({ ownerUserId: scopeOrOwnerUserId });
}

export function resolveBridgeMt5Scope(meta) {
    if (!meta?.isBridgeAuthenticated) return createMt5Scope();
    return createMt5Scope({
        ownerUserId: meta.authType === "user" && meta.userId ? meta.userId : null,
        accountLogin: meta.bridgeAccountLogin,
        terminalId: meta.bridgeTerminalId,
        broker: meta.bridgeBroker,
    });
}

export function resolveClientMt5Scope(meta) {
    if (!meta || meta.isBridgeAuthenticated) return createMt5Scope();
    const accountLogin = normalizeOptional(meta.selectedMt5AccountLogin);
    if (accountLogin && meta.userId) {
        return createMt5Scope({
            ownerUserId: meta.userId,
            accountLogin,
            terminalId: meta.selectedMt5TerminalId,
            broker: meta.selectedMt5Broker,
        });
    }
    return createMt5Scope();
}

export function isRecipientForMt5Scope(meta, scopeInput) {
    if (!meta || meta.isBridgeAuthenticated) return false;
    const scope = normalizeScope(scopeInput);

    if (!scope.isPersonal) {
        return !normalizeOptional(meta.selectedMt5AccountLogin);
    }

    if (String(meta.userId || "") !== String(scope.ownerUserId || "")) return false;
    if (normalizeOptional(meta.selectedMt5AccountLogin) !== scope.accountLogin) return false;

    const selectedTerminal = normalizeOptional(meta.selectedMt5TerminalId);
    if (scope.terminalId && selectedTerminal && selectedTerminal !== scope.terminalId) return false;
    return true;
}

// Backward-compatible helpers retained for callers that only know user ownership.
export function resolveBridgeOwnerUserId(meta) {
    return resolveBridgeMt5Scope(meta).ownerUserId;
}

export function isRecipientForMt5Owner(meta, ownerUserId) {
    return isRecipientForMt5Scope(meta, createMt5Scope({ ownerUserId }));
}

export function scopeMetadata(scopeInput) {
    const scope = normalizeScope(scopeInput);
    return {
        source: scope.source,
        account_login: scope.accountLogin,
        terminal_id: scope.terminalId,
        broker: scope.broker,
    };
}

export function setScopedMt5Price(mt5Prices, scopeInput, payload) {
    const symbol = normalizeSymbol(payload?.symbol);
    if (!symbol) return null;
    const scope = normalizeScope(scopeInput);
    const key = `${scope.scopeId}|${symbol}`;
    const nextValue = {
        ...payload,
        symbol,
        source: scope.source,
        ownerUserId: scope.ownerUserId,
        accountLogin: scope.accountLogin,
        terminalId: scope.terminalId,
        broker: scope.broker,
        scopeId: scope.scopeId,
    };
    mt5Prices.set(key, nextValue);
    return nextValue;
}

export function getScopedMt5Price(mt5Prices, scopeInput, symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return null;
    const scope = normalizeScope(scopeInput);
    return mt5Prices.get(`${scope.scopeId}|${normalized}`) || null;
}

export function getScopedMt5Prices(mt5Prices, scopeInput) {
    const scope = normalizeScope(scopeInput);
    const values = [];
    for (const item of mt5Prices.values()) {
        if (item?.scopeId === scope.scopeId) values.push(item);
    }
    return values;
}

export function setScopedMt5State(scopeInput, state) {
    const scope = normalizeScope(scopeInput);
    scopedMt5State.set(scope.scopeId, {
        account: state?.account || {},
        positions: Array.isArray(state?.positions) ? state.positions : [],
        orders: Array.isArray(state?.orders) ? state.orders : [],
        scope,
    });
}

export function getScopedMt5State(scopeInput) {
    const scope = normalizeScope(scopeInput);
    return scopedMt5State.get(scope.scopeId) || null;
}

export function clearScopedMt5State(scopeInput) {
    const scope = normalizeScope(scopeInput);
    scopedMt5State.delete(scope.scopeId);
}

export function setScopedMt5Symbols(scopeInput, symbols) {
    const scope = normalizeScope(scopeInput);
    scopedMt5Symbols.set(scope.scopeId, {
        symbols: Array.isArray(symbols) ? symbols : [],
        scope,
    });
}

export function getScopedMt5Symbols(scopeInput) {
    const scope = normalizeScope(scopeInput);
    return scopedMt5Symbols.get(scope.scopeId)?.symbols || [];
}

export function clearScopedMt5Symbols(scopeInput) {
    const scope = normalizeScope(scopeInput);
    scopedMt5Symbols.delete(scope.scopeId);
}

export function clearScopedMt5Prices(mt5Prices, scopeInput) {
    const scope = normalizeScope(scopeInput);
    for (const [key, value] of mt5Prices.entries()) {
        if (value?.scopeId === scope.scopeId || String(key).startsWith(`${scope.scopeId}|`)) {
            mt5Prices.delete(key);
        }
    }
}
