#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "symbol-logos", "crypto");
const MANIFEST_TS = path.join(
  ROOT,
  "src",
  "features",
  "chart",
  "components",
  "crypto-auto-logo-manifest.ts"
);

const ICON_BASE_URL = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color";
const ERIKTHIART_PNG_BASE_URL = "https://raw.githubusercontent.com/ErikThiart/cryptocurrency-icons/master/128";
const COINCAP_PNG_BASE_URL = "https://static.coincap.io/assets/icons";
const BINANCE_EXCHANGE_INFO = "https://api.binance.com/api/v3/exchangeInfo";

const SYMBOL_ALIASES = {
  "1INCH": "1inch",
  "1000SHIB": "shib",
  "1000PEPE": "pepe",
  "1000FLOKI": "floki",
  "1000BONK": "bonk",
};

function normalizeBaseToken(symbol) {
  const upper = String(symbol || "").toUpperCase().trim();
  if (!upper.endsWith("USDT")) return "";
  return upper.slice(0, -4);
}

function iconCandidatesForToken(token) {
  const lower = token.toLowerCase();
  const stripped1000 = lower.replace(/^1000/, "");
  const strippedLeadingDigits = lower.replace(/^\d+/, "");
  const out = new Set([
    SYMBOL_ALIASES[token] || "",
    lower,
    stripped1000,
    strippedLeadingDigits,
  ].filter(Boolean));
  return Array.from(out);
}

async function fetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes("<svg")) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchPng(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("image")) return null;
    const arr = new Uint8Array(await res.arrayBuffer());
    if (arr.length < 150) return null;
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

async function fetchUsdtTradingSymbols() {
  const res = await fetch(BINANCE_EXCHANGE_INFO);
  if (!res.ok) throw new Error(`Failed to fetch exchangeInfo: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.symbols)) return [];
  return data.symbols
    .filter((s) => s?.status === "TRADING" && String(s?.symbol || "").endsWith("USDT"))
    .map((s) => String(s.symbol));
}

function buildManifest(entries) {
  const rows = entries
    .sort((a, b) => a.token.localeCompare(b.token))
    .map((it) => `  "${it.token}": "${it.src}",`)
    .join("\n");
  return `export const CRYPTO_AUTO_LOGO_SRC: Record<string, string> = {\n${rows}\n};\n`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const symbols = await fetchUsdtTradingSymbols();
  const bases = Array.from(new Set(symbols.map((s) => normalizeBaseToken(s)).filter(Boolean))).sort();

  const ok = [];
  const failed = [];

  for (const token of bases) {
    const stem = token.toLowerCase();
    const svgFile = `${stem}.svg`;
    const pngFile = `${stem}.png`;
    const svgOut = path.join(OUT_DIR, svgFile);
    const pngOut = path.join(OUT_DIR, pngFile);
    if (fs.existsSync(svgOut) || fs.existsSync(pngOut)) {
      ok.push({
        token,
        src: fs.existsSync(svgOut)
          ? `/symbol-logos/crypto/${svgFile}`
          : `/symbol-logos/crypto/${pngFile}`,
      });
      continue;
    }

    let svg = null;
    let png = null;
    for (const cand of iconCandidatesForToken(token)) {
      svg = await fetchText(`${ICON_BASE_URL}/${cand}.svg`);
      if (svg) break;

      png = await fetchPng(`${ERIKTHIART_PNG_BASE_URL}/${cand}.png`);
      if (png) break;

      png = await fetchPng(`${COINCAP_PNG_BASE_URL}/${cand}@2x.png`);
      if (png) break;
    }

    if (svg) {
      fs.writeFileSync(svgOut, svg, "utf8");
      ok.push({ token, src: `/symbol-logos/crypto/${svgFile}` });
    } else if (png) {
      fs.writeFileSync(pngOut, png);
      ok.push({ token, src: `/symbol-logos/crypto/${pngFile}` });
    } else {
      failed.push(token);
    }
  }

  fs.writeFileSync(MANIFEST_TS, buildManifest(ok), "utf8");

  console.log(`[crypto-logos] usdt symbols: ${symbols.length}`);
  console.log(`[crypto-logos] unique bases: ${bases.length}`);
  console.log(`[crypto-logos] logos available: ${ok.length}`);
  if (failed.length) {
    console.log(`[crypto-logos] missing: ${failed.length}`);
  } else {
    console.log("[crypto-logos] no missing tokens");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
