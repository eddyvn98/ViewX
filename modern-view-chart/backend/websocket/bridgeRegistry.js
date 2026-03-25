const DEFAULT_ACCOUNT_KEY = "__default__";

function normalizeKey(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function normalizeAccountValue(value) {
    if (!value || typeof value !== "object") return value;
    return value.id ?? value.accountId ?? value.account_id ?? value.number ?? null;
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
                source.mt5Account ??
                source.mt5AccountId
        )
    );

    return {
        userId,
        accountId,
    };
}

function resolveBridgeKey(metadata = {}) {
    const routeTarget = resolveRouteTarget(metadata);
    if (!routeTarget.userId) return null;

    return {
        userId: routeTarget.userId,
        accountId: routeTarget.accountId || DEFAULT_ACCOUNT_KEY,
    };
}

function isRouteMismatch(base = {}, target = {}) {
    const baseUserId = normalizeKey(base.userId);
    const baseAccountId = normalizeKey(base.accountId);
    const targetUserId = normalizeKey(target.userId);
    const targetAccountId = normalizeKey(target.accountId);

    if (baseUserId && targetUserId && baseUserId !== targetUserId) return true;
    if (baseAccountId && targetAccountId && baseAccountId !== targetAccountId) return true;
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
        if (existingKey && existingKey.userId === key.userId && existingKey.accountId === key.accountId) {
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

        let sockets = accountMap.get(key.accountId);
        if (!sockets) {
            sockets = new Set();
            accountMap.set(key.accountId, sockets);
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

    get(userId, accountId) {
        const userKey = normalizeKey(userId);
        if (!userKey) return [];

        const accountMap = this.byUser.get(userKey);
        if (!accountMap) return [];

        if (accountId !== undefined && accountId !== null) {
            const accountKey = normalizeKey(accountId) || DEFAULT_ACCOUNT_KEY;
            return Array.from(accountMap.get(accountKey) || []);
        }

        const sockets = [];
        for (const accountSockets of accountMap.values()) {
            sockets.push(...accountSockets);
        }
        return sockets;
    }

    getAnyOpenSocket() {
        for (const socketsByAccount of this.byUser.values()) {
            for (const sockets of socketsByAccount.values()) {
                for (const ws of sockets) {
                    if (ws?.readyState === ws.OPEN) return ws;
                }
            }
        }
        return null;
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
        const routeTarget = resolveRouteTarget(metadata);
        if (routeTarget.userId) {
            const sockets = this.get(routeTarget.userId, routeTarget.accountId);
            for (const ws of sockets) {
                if (ws?.readyState === ws.OPEN) return ws;
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

            recipients.push(clientWs);
        }

        return recipients;
    }

    isRouteMismatch(base = {}, target = {}) {
        return isRouteMismatch(base, target);
    }

    _removeSocket(ws, key) {
        const accountMap = this.byUser.get(key.userId);
        const sockets = accountMap?.get(key.accountId);

        if (sockets) {
            sockets.delete(ws);
            if (sockets.size === 0) {
                accountMap.delete(key.accountId);
            }
        }

        if (accountMap && accountMap.size === 0) {
            this.byUser.delete(key.userId);
        }

        this.bySocket.delete(ws);
    }
}

export const bridgeRegistry = new BridgeRegistry();

export { DEFAULT_ACCOUNT_KEY, resolveBridgeKey, resolveRouteTarget, isRouteMismatch, BridgeRegistry };

export default bridgeRegistry;
