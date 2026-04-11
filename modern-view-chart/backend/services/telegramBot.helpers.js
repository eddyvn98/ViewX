import crypto from "crypto";
import { normalizeIndicatorType, stripDiacritics } from "./telegramBot.indicators.js";
import { TIMEFRAME_OPTIONS } from "./telegramBot.constants.js";

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function normalizeSymbol(input) {
  return String(input || "").trim().toUpperCase();
}

export function normalizeTimeframe(input) {
  const raw = String(input || "").trim().toLowerCase();
  const normalized = raw === "60" ? "1h" : raw === "240" ? "4h" : raw;
  return TIMEFRAME_OPTIONS.includes(normalized) ? normalized : "5m";
}

export function timeframeToFeedInterval(timeframe) {
  switch (normalizeTimeframe(timeframe)) {
    case "1m": return { binance: "1m", stored: ["1m", "1"] };
    case "5m": return { binance: "5m", stored: ["5m", "5"] };
    case "15m": return { binance: "15m", stored: ["15m", "15"] };
    case "1h": return { binance: "1h", stored: ["1h", "60"] };
    case "4h": return { binance: "4h", stored: ["4h", "240"] };
    default: return { binance: "5m", stored: ["5m", "5"] };
  }
}

export function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "-";
  if (Math.abs(num) >= 1000) return num.toFixed(2);
  if (Math.abs(num) >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

export function formatTimestamp(timestamp) {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Date(value).toLocaleString("vi-VN", { hour12: false });
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeDot(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"");
}

export function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function normalizeChartIntervalToBotTimeframe(interval) {
  const raw = String(interval || "").trim().toLowerCase();
  if (raw === "1" || raw === "1m") return "1m";
  if (raw === "5" || raw === "5m") return "5m";
  if (raw === "15" || raw === "15m") return "15m";
  if (raw === "60" || raw === "1h" || raw === "h1") return "1h";
  if (raw === "240" || raw === "4h" || raw === "h4") return "4h";
  return "5m";
}

export function normalizeRequestedTimeframe(input) {
  const raw = stripDiacritics(String(input || "").trim().toLowerCase()).replace(/\s+/g, "");
  if (!raw) return "";
  if (raw === "m1" || raw === "1m" || raw === "1") return "1m";
  if (raw === "m5" || raw === "5m" || raw === "5") return "5m";
  if (raw === "m15" || raw === "15m" || raw === "15") return "15m";
  if (raw === "h1" || raw === "1h" || raw === "60") return "1h";
  if (raw === "h4" || raw === "4h" || raw === "240") return "4h";
  return "";
}

export function normalizeMatrixTimeframe(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "h1" || raw === "60") return "1h";
  if (raw === "h2" || raw === "120") return "2h";
  if (raw === "h4" || raw === "240") return "4h";
  if (raw === "d1" || raw === "1440") return "1d";
  if (raw.startsWith("m") && /^\d+$/.test(raw.slice(1))) return `${raw.slice(1)}m`;
  if (/^\d+$/.test(raw)) return `${raw}m`;
  return raw;
}

export function buildMatrixScopeKey(strategyId, symbol, timeframe) {
  return `${String(strategyId || "").trim()}:${normalizeSymbol(symbol)}:${normalizeMatrixTimeframe(timeframe)}`;
}

export function parseWebDrivenCrossIntent(text) {
  const plain = stripDiacritics(String(text || "").trim().toLowerCase());
  if (!plain) return null;
  const main = plain.match(
    /(?:canh bao|alert)?\s*(?:khi|neu)?\s*([a-z_]{2,30})\s*(?:va|voi)\s*([a-z_]{2,30}).{0,40}(?:giao cat nhau|giao cat|cat nhau|cross|giao nhau)/i,
  );
  const tfMatch = plain.match(/(?:khung|timeframe|tf)\s*(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|1|5|15|60|240)\b/i);
  const requestedTimeframe = normalizeRequestedTimeframe(tfMatch?.[1] || "");
  const symbolMatch = plain.match(/(?:ma|symbol|cap)\s*([a-z0-9._-]{2,24})/i);
  const requestedSymbol = normalizeSymbol(symbolMatch?.[1] || "");
  if (!main) return null;
  const leftType = normalizeIndicatorType(main[1]);
  const rightType = normalizeIndicatorType(main[2]);
  if (!leftType || !rightType) return null;
  return { leftType, rightType, requestedTimeframe, requestedSymbol };
}
