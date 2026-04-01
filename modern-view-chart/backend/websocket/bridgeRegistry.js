const DEFAULT_ACCOUNT_KEY = "__default__";
const DEFAULT_TERMINAL_KEY = "__default_terminal__";

function normalizeKey(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function normalizeAccountValue(value) {
    if (!value || typeof value !== "object") return value;
    return value.id ?? value.accountId ?? value.account_id ?? value.number ?? value.login ?? null;
}

function extractRouteSource(metadata = {}) {
    if (!metadata || typeof metadata !== "object") return {};
    return metadata.target && typeof metadata.target === "object"
        ? metadata.target
        : metadata.route && typeof metadata.route === "object"
            ? metadata.route
            : metadata.meta && typeof metadata.meta === "object"
                ? metadata.meta
                : metadata;
}

function resolveRouteTarget(metadata = {}) {
    const source = extractRouteSource(metadata);
    const userId = normalizeKey(
        source.userId ??
            source.user_id ??
            source.scopeId ??
            source.user ??
            source.clientUserId
    );

    const accountId = normalizeKey(
        normalizeAccountValue(
            source.accountId ??
                source.account_id ??
                source.account ??
                source.accountNumber ??
                source.accountLogin ??
                source.account_login ??
                source.mt5Account ??
                source.mt5AccountId ??
                source.accountLogin
        )
    );

    const terminalId = normalizeKey(
        source.terminalId ??
            source.terminal_id ??
            source.terminal ??
            source.bridgeId ??
            source.bridge_id
    );
    const bridgeId = normalizeKey(source.bridgeId ?? source.bridge_id);
    const bridgeSource = normalizeKey(source.bridgeSource ?? source.bridge_source ?? source.source);

    return {
        userId,
        accountId,
        bridgeId,
        bridgeSource,
        terminalId,
    };
}

function resolveBridgeKey(metadata = {}) {
    const routeTarget = resolveRouteTarget(metadata);
    if (!routeTarget.userId) return null;

    return {
        userId: routeTarget.userId,
        accountId: routeTarget.accountId || DEFAULT_ACCOUNT_KEY,
        terminalId: routeTarget.terminalId || DEFAULT_TERMINAL_KEY,
    };
}

function isRouteMismatch(base = {}, target = {}) {
    const baseUserId = normalizeKey(base.userId);
    const baseAccountId = normalizeKey(base.accountId);
    const baseTerminalId = normalizeKey(base.terminalId);
    const targetUserId = normalizeKey(target.userId);
    const targetAccountId = normalizeKey(target.accountId);
    const targetTerminalId = normalizeKey(target.terminalId);

    if (baseUserId && targetUserId && baseUserId !== targetUserId) return true;
    if (baseAccountId && targetAccountId && baseAccountId !== targetAccountId) return true;
    if (baseTerminalId && targetTerminalId && baseTerminalId !== targetTerminalId) return true;
    return false;
}

class BridgeRegistry {
    constructor() {
        this.byUser = new Map();
        this.bySocket = new Map();
    }

    register(ws, metadata = {}) {
        if (!ws) return null;

        const key = resolveBridgeKey(metadata);
        if (!key) return null;

        const existingKey = this.bySocket.get(ws);
        if (
            existingKey &&
            existingKey.userId === key.userId &&
            existingKey.accountId === key.accountId &&
            existingKey.terminalId === key.terminalId
        ) {
            return key;
        }

        if (existingKey) {
            this._removeSocket(ws, existingKey);
        }

        let accountMap = this.byUser.get(key.userId);
        if (!accountMap) {
            accountMap = new Map();
            this.byUser.set(key.userId, accountMap);
        }

        let terminalMap = accountMap.get(key.accountId);
        if (!terminalMap) {
            terminalMap = new Map();
            accountMap.set(key.accountId, terminalMap);
        }

        let sockets = terminalMap.get(key.terminalId);
        if (!sockets) {
            sockets = new Set();
            terminalMap.set(key.terminalId, sockets);
        }
        sockets.add(ws);
        this.bySocket.set(ws, key);

        return key;
    }

    unregister(ws) {
        if (!ws) return false;

        const existingKey = this.bySocket.get(ws);
        if (!existingKey) return false;

        this._removeSocket(ws, existingKey);
        return true;
    }

    getKey(ws) {
        return this.bySocket.get(ws) || null;
    }

    get(userId, accountId, terminalId = null) {
        const userKey = normalizeKey(userId);
        if (!userKey) return [];

        const accountMap = this.byUser.get(userKey);
        if (!accountMap) return [];

        if (accountId !== undefined && accountId !== null) {
            const accountKey = normalizeKey(accountId) || DEFAULT_ACCOUNT_KEY;
            const terminalMap = accountMap.get(accountKey);
            if (!terminalMap) return [];

            const terminalKey = normalizeKey(terminalId);
            if (terminalKey) {
                const exact = Array.from(terminalMap.get(terminalKey) || []);
                if (exact.length > 0) return exact;
                return Array.from(terminalMap.get(DEFAULT_TERMINAL_KEY) || []);
            }

            const sockets = [];
            for (const accountSockets of terminalMap.values()) {
                sockets.push(...accountSockets);
            }
            return sockets;
        }

        const sockets = [];
        for (const terminalMap of accountMap.values()) {
            for (const accountSockets of terminalMap.values()) {
                sockets.push(...accountSockets);
            }
        }
        return sockets;
    }

    getAnyOpenSocket() {
        for (const terminalMapByAccount of this.byUser.values()) {
            for (const terminalMap of terminalMapByAccount.values()) {
                for (const sockets of terminalMap.values()) {
                    for (const ws of sockets) {
                        if (ws?.readyState === ws.OPEN) return ws;
                    }
                }
            }
        }
        return null;
    }

    hasAnyBridgeForUserAccount(userId, accountId) {
        const userKey = normalizeKey(userId);
        if (!userKey) return false;

        const accountKey = normalizeKey(accountId) || DEFAULT_ACCOUNT_KEY;
        const accountMap = this.byUser.get(userKey);
        const terminalMap = accountMap?.get(accountKey);
        if (!terminalMap) return false;

        for (const sockets of terminalMap.values()) {
            for (const ws of sockets) {
                if (ws?.readyState === ws.OPEN) return true;
            }
        }
        return false;
    }

    getLegacyBridgeSocket(clients) {
        if (!clients) return null;

        for (const [ws, meta] of clients.entries()) {
            if (!meta?.isBridgeAuthenticated) continue;
            if (ws.readyState === ws.OPEN) return ws;
        }

        return null;
    }

    getPrimarySocket(metadata = {}, clients = null) {
        const isBridgeSocket = (ws) => {
            if (!ws || ws.readyState !== ws.OPEN) return false;
            if (!clients) return true;
            const meta = clients.get(ws);
            return Boolean(meta?.isBridgeAuthenticated);
        };

        const routeTarget = resolveRouteTarget(metadata);
        if (routeTarget.userId) {
            const sockets = this.get(routeTarget.userId, routeTarget.accountId, routeTarget.terminalId);
            for (const ws of sockets) {
                if (isBridgeSocket(ws)) return ws;
            }
            return null;
        }

        return this.getLegacyBridgeSocket(clients) || this.getAnyOpenSocket();
    }

    getTargetClientSockets(clients, metadata = {}, { excludeWs = null } = {}) {
        if (!clients) return [];

        const routeTarget = resolveRouteTarget(metadata);
        const recipients = [];
        const hasRouteTarget = Boolean(routeTarget.userId || routeTarget.accountId);

        for (const [clientWs, clientMeta] of clients.entries()) {
            if (excludeWs && clientWs === excludeWs) continue;
            if (clientWs.readyState !== clientWs.OPEN) continue;
            if (clientMeta?.isBridgeAuthenticated) continue;

            if (!hasRouteTarget) {
                recipients.push(clientWs);
                continue;
            }

            if (normalizeKey(clientMeta?.userId) !== routeTarget.userId) continue;
            if (routeTarget.accountId && normalizeKey(clientMeta?.accountId) !== routeTarget.accountId) continue;
            if (
                routeTarget.terminalId &&
                normalizeKey(clientMeta?.terminalId) &&
                normalizeKey(clientMeta?.terminalId) !== routeTarget.terminalId
            ) continue;

            recipients.push(clientWs);
        }

        return recipients;
    }

    isRouteMismatch(base = {}, target = {}) {
        return isRouteMismatch(base, target);
    }

    _removeSocket(ws, key) {
        const accountMap = this.byUser.get(key.userId);
        const terminalMap = accountMap?.get(key.accountId);
        const sockets = terminalMap?.get(key.terminalId);

        if (sockets) {
            sockets.delete(ws);
            if (sockets.size === 0) {
                terminalMap.delete(key.terminalId);
            }
        }

        if (terminalMap && terminalMap.size === 0) {
            accountMap.delete(key.accountId);
        }

        if (accountMap && accountMap.size === 0) {
            this.byUser.delete(key.userId);
        }

        this.bySocket.delete(ws);
    }
}

export const bridgeRegistry = new BridgeRegistry();

export { DEFAULT_ACCOUNT_KEY, DEFAULT_TERMINAL_KEY, resolveBridgeKey, resolveRouteTarget, isRouteMismatch, BridgeRegistry };

export default bridgeRegistry;
