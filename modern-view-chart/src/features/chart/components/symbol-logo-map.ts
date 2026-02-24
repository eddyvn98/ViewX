import { EQUITY_AUTO_LOGO_SRC } from "./equity-auto-logo-manifest";

export type AssetClass = "CRYPTO" | "FOREX" | "METAL" | "INDEX" | "COMMODITY" | "EQUITY" | "UNKNOWN";

export interface LogoEntry {
    key: string;
    src?: string;
    srcLight?: string;
    srcDark?: string;
    alt: string;
}

export type ResolvedSymbolLogo =
    | { type: "single"; assetClass: AssetClass; logo: LogoEntry }
    | { type: "forex-pair"; assetClass: AssetClass; base: LogoEntry; quote: LogoEntry }
    | { type: "fallback"; assetClass: AssetClass; label: string };

const FOREX_CODES = [
    "EUR",
    "USD",
    "JPY",
    "GBP",
    "AUD",
    "NZD",
    "CAD",
    "CHF",
    "CNH",
    "THB",
    "HKD",
    "NOK",
    "SEK",
    "MXN",
    "TRY",
    "ZAR",
    "PLN",
    "DKK",
    "ILS",
    "SGD",
];

const CURRENCY_LOGOS: Record<string, LogoEntry> = {
    EUR: { key: "EUR", src: "/symbol-logos/eur.svg", alt: "EUR" },
    USD: { key: "USD", src: "/symbol-logos/usd.svg", alt: "USD" },
    JPY: { key: "JPY", src: "/symbol-logos/jpy.svg", alt: "JPY" },
    GBP: { key: "GBP", src: "/symbol-logos/gbp.svg", alt: "GBP" },
    AUD: { key: "AUD", src: "/symbol-logos/aud.svg", alt: "AUD" },
    NZD: { key: "NZD", src: "/symbol-logos/nzd.svg", alt: "NZD" },
    CAD: { key: "CAD", src: "/symbol-logos/cad.svg", alt: "CAD" },
    CHF: { key: "CHF", src: "/symbol-logos/chf.svg", alt: "CHF" },
};

const SYMBOL_LOGOS: Record<string, LogoEntry> = {
    BTC: { key: "BTC", src: "/symbol-logos/btc.svg", alt: "Bitcoin" },
    ETH: { key: "ETH", src: "/symbol-logos/eth.svg", alt: "Ethereum" },
    XAU: { key: "XAU", src: "/symbol-logos/xau.svg", alt: "Gold" },
    XAG: { key: "XAG", src: "/symbol-logos/xag.svg", alt: "Silver" },
    US30: { key: "US30", src: "/symbol-logos/us30.svg", alt: "US30" },
    NAS100: { key: "NAS100", src: "/symbol-logos/nas100.svg", alt: "NAS100" },
    GER40: { key: "GER40", src: "/symbol-logos/ger40.svg", alt: "GER40" },
    UK100: { key: "UK100", src: "/symbol-logos/uk100.svg", alt: "UK100" },
    WTI: { key: "WTI", src: "/symbol-logos/wti.svg", alt: "WTI Crude" },
    BRENT: { key: "BRENT", src: "/symbol-logos/brent.svg", alt: "Brent Crude" },
    AAPL: {
        key: "AAPL",
        src: "/symbol-logos/aapl.svg",
        srcLight: "/symbol-logos/aapl-light.svg",
        srcDark: "/symbol-logos/aapl-dark.svg",
        alt: "Apple",
    },
    NVDA: {
        key: "NVDA",
        src: "/symbol-logos/nvda.svg",
        srcLight: "/symbol-logos/nvda-light.svg",
        srcDark: "/symbol-logos/nvda-dark.svg",
        alt: "NVIDIA",
    },
    AMZN: {
        key: "AMZN",
        src: "/symbol-logos/amzn.svg",
        srcLight: "/symbol-logos/amzn-light.svg",
        srcDark: "/symbol-logos/amzn-dark.svg",
        alt: "Amazon",
    },
    ADBE: { key: "ADBE", src: "/symbol-logos/adbe.svg", alt: "Adobe" },
    AMD: { key: "AMD", src: "/symbol-logos/amd.svg", alt: "AMD" },
    AVGO: { key: "AVGO", src: "/symbol-logos/avgo.svg", alt: "Broadcom" },
    BA: { key: "BA", src: "/symbol-logos/ba.svg", alt: "Boeing" },
    BABA: { key: "BABA", src: "/symbol-logos/baba.svg", alt: "Alibaba" },
    BAC: { key: "BAC", src: "/symbol-logos/bac.svg", alt: "Bank of America" },
    BIDU: { key: "BIDU", src: "/symbol-logos/bidu.svg", alt: "Baidu" },
    BILI: { key: "BILI", src: "/symbol-logos/bili.svg", alt: "Bilibili" },
    CSCO: { key: "CSCO", src: "/symbol-logos/csco.svg", alt: "Cisco" },
    F: { key: "F", src: "/symbol-logos/f.svg", alt: "Ford" },
    GOOGL: { key: "GOOGL", src: "/symbol-logos/googl.svg", alt: "Google" },
    IBM: { key: "IBM", src: "/symbol-logos/ibm.svg", alt: "IBM" },
    INTC: { key: "INTC", src: "/symbol-logos/intc.svg", alt: "Intel" },
    KO: { key: "KO", src: "/symbol-logos/ko.svg", alt: "Coca-Cola" },
    MA: { key: "MA", src: "/symbol-logos/ma.svg", alt: "Mastercard" },
    MCD: { key: "MCD", src: "/symbol-logos/mcd.svg", alt: "McDonald's" },
    META: { key: "META", src: "/symbol-logos/meta.svg", alt: "Meta" },
    MRK: { key: "MRK", src: "/symbol-logos/mrk.svg", alt: "Merck" },
    MSFT: { key: "MSFT", src: "/symbol-logos/msft.svg", alt: "Microsoft" },
    NFLX: { key: "NFLX", src: "/symbol-logos/nflx.svg", alt: "Netflix" },
    NKE: { key: "NKE", src: "/symbol-logos/nke.svg", alt: "Nike" },
    ORCL: { key: "ORCL", src: "/symbol-logos/orcl.svg", alt: "Oracle" },
    PEP: { key: "PEP", src: "/symbol-logos/pep.svg", alt: "Pepsi" },
    PYPL: { key: "PYPL", src: "/symbol-logos/pypl.svg", alt: "PayPal" },
    SBUX: { key: "SBUX", src: "/symbol-logos/sbux.svg", alt: "Starbucks" },
    T: { key: "T", src: "/symbol-logos/t.svg", alt: "AT&T" },
    TMUS: { key: "TMUS", src: "/symbol-logos/tmus.svg", alt: "T-Mobile" },
    TSLA: { key: "TSLA", src: "/symbol-logos/tsla.svg", alt: "Tesla" },
    V: { key: "V", src: "/symbol-logos/v.svg", alt: "Visa" },
    VZ: { key: "VZ", src: "/symbol-logos/vz.svg", alt: "Verizon" },
    WMT: { key: "WMT", src: "/symbol-logos/wmt.svg", alt: "Walmart" },
};

const KNOWN_FOREX_CODES = new Set(FOREX_CODES);
const INDEX_PREFIXES = ["US30", "US500", "USTEC", "NAS100", "GER40", "DE30", "UK100", "AUS200", "FR40", "HK50", "JP225", "STOXX50", "DXY"];
const COMMODITY_PREFIXES = ["WTI", "BRENT", "USOIL", "UKOIL", "XNG"];
const METAL_PREFIXES = ["XAU", "XAG", "XPD", "XPT", "XAL", "XCU", "XNI", "XPB", "XZN"];
const CRYPTO_PREFIXES = ["BTC", "ETH", "SOL", "LTC", "XRP", "DOGE"];

const SYMBOL_PREFIX_ALIASES: Array<{ prefix: string; key: string }> = [
    { prefix: "BTC", key: "BTC" },
    { prefix: "ETH", key: "ETH" },
    { prefix: "XAU", key: "XAU" },
    { prefix: "XAG", key: "XAG" },
    { prefix: "US30", key: "US30" },
    { prefix: "NAS100", key: "NAS100" },
    { prefix: "GER40", key: "GER40" },
    { prefix: "UK100", key: "UK100" },
    { prefix: "WTI", key: "WTI" },
    { prefix: "USOIL", key: "WTI" },
    { prefix: "BRENT", key: "BRENT" },
    { prefix: "UKOIL", key: "BRENT" },
    { prefix: "FB", key: "META" },
];

function normalizeSymbol(raw: string): string {
    const upper = (raw || "").toUpperCase().trim();
    if (!upper) return "";
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    return compact.endsWith("M") ? compact.slice(0, -1) : compact;
}

function getTokenLogo(token: string): LogoEntry | null {
    return CURRENCY_LOGOS[token] || SYMBOL_LOGOS[token] || null;
}

function isAlphaCode(text: string): boolean {
    return /^[A-Z]{3}$/.test(text);
}

function extractForexPair(symbol: string): { base: string; quote: string } | null {
    if (symbol.length < 6) return null;
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    if (!isAlphaCode(base) || !isAlphaCode(quote)) return null;
    if (!KNOWN_FOREX_CODES.has(base) || !KNOWN_FOREX_CODES.has(quote)) return null;
    return { base, quote };
}

function classifyAsset(symbol: string): AssetClass {
    if (!symbol) return "UNKNOWN";
    if (METAL_PREFIXES.some((prefix) => symbol.startsWith(prefix))) return "METAL";
    if (CRYPTO_PREFIXES.some((prefix) => symbol.startsWith(prefix))) return "CRYPTO";
    if (INDEX_PREFIXES.some((prefix) => symbol.startsWith(prefix))) return "INDEX";
    if (COMMODITY_PREFIXES.some((prefix) => symbol.startsWith(prefix)) || symbol.endsWith("OIL")) return "COMMODITY";
    if (extractForexPair(symbol)) return "FOREX";
    if (/^[A-Z]{1,6}$/.test(symbol)) return "EQUITY";
    return "UNKNOWN";
}

export function resolveSymbolLogo(rawSymbol: string): ResolvedSymbolLogo {
    const normalized = normalizeSymbol(rawSymbol);
    const assetClass = classifyAsset(normalized);

    const symbolSpecific = [normalized];
    for (const entry of SYMBOL_PREFIX_ALIASES) {
        if (normalized.startsWith(entry.prefix)) symbolSpecific.push(entry.key);
    }

    for (const key of symbolSpecific) {
        const logo = getTokenLogo(key);
        if (logo) {
            return { type: "single", assetClass, logo };
        }
    }

    if (assetClass === "FOREX") {
        const pair = extractForexPair(normalized);
        if (!pair) {
            return { type: "fallback", assetClass, label: normalized.slice(0, 6) || "FX" };
        }
        const baseCode = pair.base;
        const quoteCode = pair.quote;
        const base = getTokenLogo(baseCode);
        const quote = getTokenLogo(quoteCode);
        return {
            type: "forex-pair",
            assetClass,
            base: base || { key: baseCode, alt: baseCode },
            quote: quote || { key: quoteCode, alt: quoteCode },
        };
    }

    if (assetClass === "EQUITY" && EQUITY_AUTO_LOGO_SRC[normalized]) {
        return {
            type: "single",
            assetClass,
            logo: {
                key: normalized,
                src: EQUITY_AUTO_LOGO_SRC[normalized],
                alt: normalized,
            },
        };
    }

    return {
        type: "fallback",
        assetClass,
        label: normalized.slice(0, 6) || "?",
    };
}
