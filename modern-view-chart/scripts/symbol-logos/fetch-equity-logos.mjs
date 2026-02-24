#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "symbol-logos", "equity");
const MANIFEST_TS = path.join(
  ROOT,
  "src",
  "features",
  "chart",
  "components",
  "equity-auto-logo-manifest.ts"
);
const SYMBOLS_FILE = process.argv[2] || path.join(ROOT, "mt5_symbols_live.txt");

const FOREX_CODES = new Set([
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
]);

const INDEX_PREFIXES = [
  "US30",
  "US500",
  "USTEC",
  "NAS100",
  "GER40",
  "DE30",
  "UK100",
  "AUS200",
  "FR40",
  "HK50",
  "JP225",
  "STOXX50",
  "DXY",
];

const COMMODITY_PREFIXES = ["WTI", "BRENT", "USOIL", "UKOIL", "XNG"];
const METAL_PREFIXES = ["XAU", "XAG", "XPD", "XPT", "XAL", "XCU", "XNI", "XPB", "XZN"];
const CRYPTO_PREFIXES = ["BTC", "ETH", "SOL", "LTC", "XRP", "DOGE"];

const TICKER_TO_SIMPLE_ICON_SLUG = {
  AAPL: "apple",
  AMZN: "amazon",
  NVDA: "nvidia",
  MSFT: "microsoft",
  GOOGL: "google",
  META: "meta",
  TSLA: "tesla",
  AMD: "amd",
  INTC: "intel",
  NFLX: "netflix",
  ORCL: "oracle",
  IBM: "ibm",
  ADBE: "adobe",
  PYPL: "paypal",
  V: "visa",
  MA: "mastercard",
  WMT: "walmart",
  NKE: "nike",
  PEP: "pepsi",
  CSCO: "cisco",
  KO: "cocacola",
  BA: "boeing",
  BABA: "alibabadotcom",
  BAC: "bankofamerica",
  BIDU: "baidu",
  BILI: "bilibili",
  F: "ford",
  MCD: "mcdonalds",
  MRK: "merck",
  SBUX: "starbucks",
  T: "atandt",
  TMUS: "tmobile",
  VZ: "verizon",
  AVGO: "broadcom",
};

function normalizeSymbol(raw) {
  const compact = String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  return compact.endsWith("M") ? compact.slice(0, -1) : compact;
}

function isForexPair(sym) {
  if (!/^[A-Z]{6}$/.test(sym)) return false;
  const base = sym.slice(0, 3);
  const quote = sym.slice(3, 6);
  return FOREX_CODES.has(base) && FOREX_CODES.has(quote);
}

function isEquitySymbol(sym) {
  if (!/^[A-Z]{1,6}$/.test(sym)) return false;
  if (isForexPair(sym)) return false;
  if (INDEX_PREFIXES.some((p) => sym.startsWith(p))) return false;
  if (COMMODITY_PREFIXES.some((p) => sym.startsWith(p)) || sym.endsWith("OIL")) return false;
  if (METAL_PREFIXES.some((p) => sym.startsWith(p))) return false;
  if (CRYPTO_PREFIXES.some((p) => sym.startsWith(p))) return false;
  return true;
}

function readMt5Symbols(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Symbols file not found: ${filePath}`);
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => normalizeSymbol(line))
    .filter(Boolean);
}

function listEquityTickers(symbols) {
  return [...new Set(symbols.filter((sym) => isEquitySymbol(sym)))].sort();
}

async function fetchSimpleIconSvg(slug) {
  const urls = [
    `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/${slug}.svg`,
    `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      // ignore and try next
    }
  }
  return null;
}

async function fetchFmpPng(ticker) {
  try {
    const res = await fetch(`https://financialmodelingprep.com/image-stock/${ticker}.png`);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image")) return null;
    const arr = new Uint8Array(await res.arrayBuffer());
    if (arr.length < 300) return null;
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

function buildManifest(entries) {
  const rows = entries
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
    .map((it) => `  "${it.ticker}": "${it.src}",`)
    .join("\n");
  return `export const EQUITY_AUTO_LOGO_SRC: Record<string, string> = {\n${rows}\n};\n`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const symbols = readMt5Symbols(SYMBOLS_FILE);
  const tickers = listEquityTickers(symbols);

  const ok = [];
  const failed = [];

  for (const ticker of tickers) {
    const fileStem = ticker.toLowerCase();
    const pngPath = path.join(OUT_DIR, `${fileStem}.png`);
    const svgPath = path.join(OUT_DIR, `${fileStem}.svg`);
    if (fs.existsSync(pngPath) || fs.existsSync(svgPath)) {
      ok.push({
        ticker,
        src: fs.existsSync(svgPath)
          ? `/symbol-logos/equity/${fileStem}.svg`
          : `/symbol-logos/equity/${fileStem}.png`,
      });
      continue;
    }

    const slug = TICKER_TO_SIMPLE_ICON_SLUG[ticker];
    if (slug) {
      const svg = await fetchSimpleIconSvg(slug);
      if (svg && svg.includes("<svg")) {
        fs.writeFileSync(svgPath, svg, "utf8");
        ok.push({ ticker, src: `/symbol-logos/equity/${fileStem}.svg` });
        continue;
      }
    }

    const png = await fetchFmpPng(ticker);
    if (png) {
      fs.writeFileSync(pngPath, png);
      ok.push({ ticker, src: `/symbol-logos/equity/${fileStem}.png` });
      continue;
    }

    failed.push(ticker);
  }

  fs.writeFileSync(MANIFEST_TS, buildManifest(ok), "utf8");

  console.log(`[logos] mt5 symbols: ${symbols.length}`);
  console.log(`[logos] equity tickers: ${tickers.length}`);
  console.log(`[logos] logos available: ${ok.length}`);
  if (failed.length) {
    console.log(`[logos] missing: ${failed.length}`);
    failed.forEach((item) => console.log(`- ${item}`));
  } else {
    console.log("[logos] no missing tickers");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
