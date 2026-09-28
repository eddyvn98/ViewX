const GLOBAL_OWNER = "__global__";
const DEFAULT_ACCOUNT = "__default_account__";
const DEFAULT_TERMINAL = "__default_terminal__";

function normalizeOptional(value) {
    const text = String(value || "").trim();
    return text || null;
}

function ownerKey(userId) {
    return userId ? String(userId) : GLOBAL_OWNER;
}

function identityKey({ userId, accountLogin, terminalId }) {
    return [
        ownerKey(userId),
        accountLogin || DEFAULT_ACCOUNT,
        terminalId || DEFAULT_TERMINAL,
    ].join("|");
}

function isOpenSocket(ws) {
    return Boolean(ws && ws.readyState === ws.OPEN);
}

export function createBridgeRegistry() {
    const bySocket = new Map();
    const byIdentity = new Map();

    function unregister(ws) {
        const record = bySocket.get(ws);
        if (!record) return null;
        bySocket.delete(ws);
        if (byIdentity.get(record.identityKey)?.ws === ws) {
            byIdentity.delete(record.identityKey);
        }
        return record;
    }

    function register(ws, meta) {
        if (!ws || !meta?.isBridgeAuthenticated) return null;

        const userId = meta.authType === "user" && meta.userId
            ? String(meta.userId)
            : null;
        const accountLogin = normalizeOptional(meta.bridgeAccountLogin);
        const terminalId = normalizeOptional(meta.bridgeTerminalId);
        const broker = normalizeOptional(meta.bridgeBroker);
        const key = identityKey({ userId, accountLogin, terminalId });

        unregister(ws);

        const replaced = byIdentity.get(key);
        if (replaced?.ws && replaced.ws !== ws) {
            unregister(replaced.ws);
            try {
                replaced.ws.close(4007, "Bridge connection replaced");
            } catch {
                // The old socket may already be closing.
            }
        }

        const record = {
            ws,
            identityKey: key,
            userId,
            accountLogin,
            terminalId,
            broker,
            clientMode: meta.clientMode || null,
            connectedAt: Date.now(),
            lastSeenAt: Date.now(),
        };
        bySocket.set(ws, record);
        byIdentity.set(key, record);
        return { record, replaced: replaced || null };
    }

    function touch(ws) {
        const record = bySocket.get(ws);
        if (!record) return false;
        record.lastSeenAt = Date.now();
        return true;
    }

    function listForUser(userId) {
        const wantedOwner = ownerKey(userId);
        return Array.from(bySocket.values())
            .filter((record) => ownerKey(record.userId) === wantedOwner)
            .filter((record) => isOpenSocket(record.ws))
            .sort((a, b) => a.connectedAt - b.connectedAt);
    }

    function resolve({ userId = null, accountLogin = null, terminalId = null } = {}) {
        const normalizedAccount = normalizeOptional(accountLogin);
        const normalizedTerminal = normalizeOptional(terminalId);
        let candidates = listForUser(userId);

        if (normalizedAccount) {
            candidates = candidates.filter((record) => record.accountLogin === normalizedAccount);
        }
        if (normalizedTerminal) {
            candidates = candidates.filter((record) => record.terminalId === normalizedTerminal);
        }

        if (candidates.length === 1) {
            return { record: candidates[0], reason: "matched", candidateCount: 1 };
        }
        if (candidates.length === 0 && userId && !normalizedAccount && !normalizedTerminal) {
            const globalService = listForUser(null).filter((record) =>
                record.clientMode === "service_bridge" &&
                !record.accountLogin &&
                !record.terminalId
            );
            if (globalService.length > 0) {
                return {
                    record: globalService[0],
                    reason: "global_service_fallback",
                    candidateCount: globalService.length,
                };
            }
        }

        if (candidates.length === 0) {
            return { record: null, reason: "not_found", candidateCount: 0 };
        }

        // Backward compatibility for the legacy global service bridge: preserve
        // the previous first-connected behavior when no account identity exists.
        if (!userId && !normalizedAccount && !normalizedTerminal) {
            const legacyService = candidates.filter((record) =>
                record.clientMode === "service_bridge" &&
                !record.accountLogin &&
                !record.terminalId
            );
            if (legacyService.length > 0) {
                return {
                    record: legacyService[0],
                    reason: legacyService.length > 1 ? "legacy_multiple_service_bridges" : "matched",
                    candidateCount: candidates.length,
                };
            }
        }

        return { record: null, reason: "ambiguous", candidateCount: candidates.length };
    }

    function hasForUser(userId) {
        if (listForUser(userId).length > 0) return true;
        if (!userId) return false;
        return listForUser(null).some((record) =>
            record.clientMode === "service_bridge" &&
            !record.accountLogin &&
            !record.terminalId
        );
    }

    function size() {
        return Array.from(bySocket.values()).filter((record) => isOpenSocket(record.ws)).length;
    }

    return {
        register,
        unregister,
        touch,
        resolve,
        hasForUser,
        listForUser,
        size,
    };
}
