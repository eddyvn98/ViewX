const DEFAULT_REQUEST_ID_GUARD_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MIN_MS = 30 * 1000;

const IGNORED_FINGERPRINT_KEYS = new Set([
    "request_id",
    "requestId",
    "sentAt",
    "sent_at",
    "timestamp",
    "ts",
    "clientTs",
    "client_ts",
]);

function normalizeTtlMs(rawValue) {
    const parsed = Number.parseInt(rawValue || "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_REQUEST_ID_GUARD_TTL_MS;
    }
    return parsed;
}

function normalizeRequestId(requestId) {
    return String(requestId || "").trim();
}

function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }

    const keys = Object.keys(value).sort();
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${pairs.join(",")}}`;
}

function buildFingerprint(data = {}) {
    const snapshot = {};
    for (const [key, value] of Object.entries(data)) {
        if (IGNORED_FINGERPRINT_KEYS.has(key)) continue;
        snapshot[key] = value;
    }
    return stableStringify(snapshot);
}

export function createRequestIdGuard(ttlMs = normalizeTtlMs(process.env.WS_REQUEST_ID_GUARD_TTL_MS)) {
    const entries = new Map();
    let lastCleanupAt = 0;
    const cleanupIntervalMs = Math.max(CLEANUP_INTERVAL_MIN_MS, Math.min(ttlMs, 60 * 1000));

    function sweepExpired(now = Date.now()) {
        if (now - lastCleanupAt < cleanupIntervalMs) {
            return;
        }
        lastCleanupAt = now;

        for (const [requestId, entry] of entries.entries()) {
            if (entry.expiresAt <= now) {
                entries.delete(requestId);
            }
        }
    }

    function claim(data = {}) {
        const requestId = normalizeRequestId(data.request_id || data.requestId);
        if (!requestId) {
            return {
                accepted: true,
                skipped: true,
                requestId: "",
                ttlMs,
            };
        }

        const now = Date.now();
        sweepExpired(now);

        const fingerprint = buildFingerprint(data);
        const existing = entries.get(requestId);
        if (existing && existing.expiresAt > now) {
            return {
                accepted: false,
                requestId,
                ttlMs,
                classification: existing.fingerprint === fingerprint ? "duplicate" : "replay",
                expiresAt: existing.expiresAt,
            };
        }

        entries.set(requestId, {
            fingerprint,
            expiresAt: now + ttlMs,
        });

        return {
            accepted: true,
            requestId,
            ttlMs,
            expiresAt: now + ttlMs,
        };
    }

    const cleanupTimer = setInterval(() => sweepExpired(Date.now()), cleanupIntervalMs);
    if (typeof cleanupTimer.unref === "function") {
        cleanupTimer.unref();
    }

    return {
        ttlMs,
        claim,
        sweepExpired,
        size() {
            return entries.size;
        },
    };
}

export const requestIdGuard = createRequestIdGuard();
