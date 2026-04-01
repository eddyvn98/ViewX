const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERNS = [
    /token/i,
    /secret/i,
    /signature/i,
    /api[-_]?key/i,
    /authorization/i,
    /password/i,
    /passphrase/i,
    /private[-_]?key/i,
];

function isSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key || "")));
}

function redactStringSecrets(value) {
    const raw = String(value || "");
    if (!raw) return raw;
    let redacted = raw;
    redacted = redacted.replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
    redacted = redacted.replace(/\b(eyJ[a-z0-9_\-]{10,}\.[a-z0-9_\-]{10,}\.[a-z0-9_\-]{10,})\b/gi, REDACTED);
    redacted = redacted.replace(/\b(sk|pk)_[a-z0-9]{12,}\b/gi, REDACTED);
    return redacted;
}

function sanitizeValue(value, key = "") {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactStringSecrets(value.message),
            stack: value.stack,
        };
    }
    if (isSensitiveKey(key)) return REDACTED;
    if (typeof value === "string") return redactStringSecrets(value);
    if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, key));
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, fieldValue] of Object.entries(value)) {
            out[key] = sanitizeValue(fieldValue, key);
        }
        return out;
    }
    return value;
}

function emit(level, event, fields = {}) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...sanitizeValue(fields),
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
        return;
    }
    if (level === "warn") {
        console.warn(line);
        return;
    }
    console.log(line);
}

export function logInfo(event, fields) {
    emit("info", event, fields);
}

export function logWarn(event, fields) {
    emit("warn", event, fields);
}

export function logError(event, fields) {
    emit("error", event, fields);
}
