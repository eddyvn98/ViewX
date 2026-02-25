function sanitizeValue(value) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, fieldValue] of Object.entries(value)) {
            out[key] = sanitizeValue(fieldValue);
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
