function toCleanString(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

function extractSymbol(value = {}) {
    if (typeof value === "string") return toCleanString(value);
    if (!value || typeof value !== "object") return "";
    return toCleanString(
        value.symbol ??
            value.name ??
            value.rawSymbol ??
            value.raw_symbol ??
            value.ticker ??
            value.code,
    );
}

function normalizeUpper(symbol) {
    return toCleanString(symbol).toUpperCase();
}

function canonicalize(rawSymbol) {
    const upper = normalizeUpper(rawSymbol);
    if (!upper) return "";

    const withoutDecorators = upper.split(/[.\-_/]/)[0] || upper;
    let candidate = withoutDecorators.replace(/[^A-Z0-9]/g, "");
    if (!candidate) return "";

    if (candidate.length >= 7 && candidate.endsWith("M")) {
        candidate = candidate.slice(0, -1);
    }

    const suffixes = ["PRO", "ECN", "RAW", "MICRO", "MINI", "STD", "LIVE", "DEMO"];
    for (const suffix of suffixes) {
        if (candidate.length > suffix.length + 3 && candidate.endsWith(suffix)) {
            candidate = candidate.slice(0, -suffix.length);
            break;
        }
    }

    return candidate;
}

function buildAliases(rawSymbol, canonicalSymbol) {
    const aliases = new Set();
    const upper = normalizeUpper(rawSymbol);
    if (upper) aliases.add(upper);
    if (canonicalSymbol) aliases.add(canonicalSymbol);
    if (upper.includes(".")) aliases.add(upper.split(".")[0]);
    if (upper.includes("_")) aliases.add(upper.split("_")[0]);
    if (upper.includes("-")) aliases.add(upper.split("-")[0]);
    return Array.from(aliases).filter(Boolean);
}

export function normalizeMt5SymbolEntry(entry = {}, context = {}) {
    const rawSymbol = extractSymbol(entry);
    if (!rawSymbol) return null;

    const canonicalSymbol = canonicalize(rawSymbol) || normalizeUpper(rawSymbol);
    const aliases = buildAliases(rawSymbol, canonicalSymbol);
    const base = typeof entry === "object" && entry !== null ? entry : {};

    return {
        ...base,
        symbol: rawSymbol,
        rawSymbol,
        canonicalSymbol,
        aliases,
        accountLogin:
            base.accountLogin ??
            base.account_login ??
            context.accountLogin ??
            context.accountId ??
            null,
        server: base.server ?? context.server ?? null,
        terminalId:
            base.terminalId ??
            base.terminal_id ??
            context.terminalId ??
            null,
    };
}

export function normalizeMt5SymbolCatalog(symbols = [], context = {}) {
    if (!Array.isArray(symbols)) return [];
    const normalized = [];
    const seen = new Set();

    for (const entry of symbols) {
        const item = normalizeMt5SymbolEntry(entry, context);
        if (!item) continue;
        const dedupeKey = `${item.rawSymbol}::${item.accountLogin || ""}::${item.terminalId || ""}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        normalized.push(item);
    }

    return normalized;
}

