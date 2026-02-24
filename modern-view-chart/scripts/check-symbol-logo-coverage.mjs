#!/usr/bin/env node

import fs from "node:fs";

const SINGLE_LOGO_KEYS = new Set([
    "BTC",
    "ETH",
    "XAU",
    "XAG",
    "US30",
    "NAS100",
    "GER40",
    "UK100",
    "WTI",
    "BRENT",
]);

const FOREX_CODES = new Set(["EUR", "USD", "JPY", "GBP", "AUD", "NZD", "CAD", "CHF"]);

const DEFAULT_SYMBOLS = [
    "BTCUSDm",
    "ETHUSDm",
    "XAUUSDm",
    "XAGUSDm",
    "EURUSDm",
    "USDJPYm",
    "GBPUSDm",
    "AUDUSDm",
    "NZDUSDm",
    "USDCADm",
    "USDCHFm",
    "US30m",
    "NAS100m",
    "GER40m",
    "UK100m",
    "WTIm",
    "BRENTm",
];

function normalizeSymbol(raw) {
    const upper = String(raw || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    return upper.endsWith("M") ? upper.slice(0, -1) : upper;
}

function hasSingleLogo(sym) {
    if (SINGLE_LOGO_KEYS.has(sym)) return true;
    if (sym.startsWith("BTC")) return true;
    if (sym.startsWith("ETH")) return true;
    if (sym.startsWith("XAU")) return true;
    if (sym.startsWith("XAG")) return true;
    if (sym.startsWith("US30")) return true;
    if (sym.startsWith("NAS100")) return true;
    if (sym.startsWith("GER40")) return true;
    if (sym.startsWith("UK100")) return true;
    if (sym.startsWith("WTI")) return true;
    if (sym.startsWith("BRENT")) return true;
    return false;
}

function hasForexPair(sym) {
    if (sym.length < 6) return false;
    const base = sym.slice(0, 3);
    const quote = sym.slice(3, 6);
    return FOREX_CODES.has(base) && FOREX_CODES.has(quote);
}

function isIndexSymbol(sym) {
    return /^(US30|US500|USTEC|NAS100|GER40|DE30|UK100|AUS200|FR40|HK50|JP225|STOXX50|DXY)/.test(sym);
}

function isEquitySymbol(sym) {
    return /^[A-Z]{1,6}$/.test(sym);
}

function readSymbolsFromArg(filePath) {
    if (!filePath) return DEFAULT_SYMBOLS;
    const content = fs.readFileSync(filePath, "utf8");
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

const argPath = process.argv[2];
const symbols = readSymbolsFromArg(argPath);

const missing = [];
for (const raw of symbols) {
    const sym = normalizeSymbol(raw);
    const covered = hasSingleLogo(sym) || hasForexPair(sym) || isIndexSymbol(sym) || isEquitySymbol(sym);
    if (!covered) {
        missing.push(raw);
    }
}

console.log(`[coverage] symbols checked: ${symbols.length}`);
if (missing.length === 0) {
    console.log("[coverage] all symbols are covered by local logo rules.");
    process.exit(0);
}

console.log(`[coverage] missing: ${missing.length}`);
for (const item of missing) {
    console.log(`- ${item}`);
}
process.exit(1);
