const WRITE_FINGERPRINT_FIELDS = [
    "command",
    "symbol",
    "ticket",
    "order_type",
    "type",
    "volume",
    "quantity",
    "sl",
    "tp",
    "price",
    "is_market",
    "magic",
    "comment",
];

function normalizeFingerprintValue(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number" || typeof value === "boolean") return value;
    return String(value).trim();
}

export function buildMt5WriteFingerprint(data = {}) {
    const normalized = {};
    for (const field of WRITE_FINGERPRINT_FIELDS) {
        normalized[field] = normalizeFingerprintValue(data[field]);
    }
    normalized.command = String(data.command || "").trim().toLowerCase();
    return JSON.stringify(normalized);
}
