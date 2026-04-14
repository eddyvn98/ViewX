export const TIMEFRAME_OPTIONS = new Set(["1m", "5m", "15m", "1h", "4h"]);

export const ALERT_INTENTS = new Set([
  "show_menu",
  "help",
  "list_alerts",
  "delete_alert",
  "delete_all_alerts",
  "create_price_alert_percent",
  "create_price_alert_absolute",
  "create_rsi_alert",
  "create_ma_cross_alert",
  "create_indicator_alert",
  "create_web_indicator_alert",
  "show_scanner_matrix",
  "unknown",
]);

const SYMBOL_MAP = {
  VANG: "XAUUSDM",
  GOLD: "XAUUSDM",
  XAU: "XAUUSDM",
  XAUUSD: "XAUUSDM",
  XAUUSDM: "XAUUSDM",
  DAU: "WTIUSD",
  OIL: "WTIUSD",
  "CHUNG KHOAN MY": "US30",
  "CHUNG KHOAN": "US30",
  US30: "US30",
  NAS100: "NAS100",
  BTC: "BTCUSD",
  BITCOIN: "BTCUSD",
  ETH: "ETHUSD",
};

export function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D");
}

export function normalizeSymbol(value) {
  const raw = String(value || "").trim().toUpperCase();
  const searchKey = stripDiacritics(raw).replace(/\s+/g, "_");
  return SYMBOL_MAP[searchKey] || raw;
}

export function normalizeTimeframe(value) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = raw === "60" || raw === "h1" || raw === "m60"
    ? "1h"
    : raw === "240" || raw === "h4" || raw === "m240"
      ? "4h"
      : raw === "m1"
        ? "1m"
        : raw === "m5"
          ? "5m"
          : raw === "m15"
            ? "15m"
            : raw;
  return TIMEFRAME_OPTIONS.has(normalized) ? normalized : "";
}

export function normalizeCompareOperator(value, fallback = ">") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === ">" || raw === ">=") return ">";
  if (raw === "<" || raw === "<=") return "<";
  if (raw === "crosses_above" || raw === "cross_up" || raw === "crossup" || raw === "cat_len") return "crosses_above";
  if (raw === "crosses_below" || raw === "cross_down" || raw === "crossdown" || raw === "cat_xuong") return "crosses_below";
  return fallback;
}

export function normalizeDirection(value, fallback = "bull") {
  const raw = String(value || "").trim().toLowerCase();
  if (["bear", "down", "below", "xuong", "giam", "lt"].includes(raw)) return "bear";
  if (["bull", "up", "above", "len", "tang", "gt"].includes(raw)) return "bull";
  return fallback;
}

export function parsePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseIndicatorToken(rawValue) {
  const raw = String(rawValue || "").trim().toUpperCase().replaceAll(" ", "");
  if (!raw) return null;
  if (raw === "PRICE" || raw === "GIA") return { type: "PRICE", period: 0 };
  const compact = raw.replaceAll("(", "").replaceAll(")", "");
  const match = compact.match(/^([A-Z_]{2,24})(\d{1,4})?$/);
  if (!match) return null;
  const type = match[1];
  const period = match[2] ? Math.max(2, Number(match[2])) : 0;
  if (!Number.isFinite(period) && type !== "PRICE") return null;
  return { type, period };
}

export function normalizeSuggestion(input) {
  const text = String(input || "").trim();
  if (!text) return null;
  if (["string?", "string", "?"].includes(text.toLowerCase())) return null;
  return text;
}

export function normalizeIntentOutput(result) {
  if (!result || typeof result !== "object") return { type: "unknown", payload: {} };
  const type = String(result.type || "unknown").trim().toLowerCase();
  const payload = result.payload && typeof result.payload === "object" ? result.payload : {};
  const suggestion = normalizeSuggestion(result.suggestion);
  return { type: ALERT_INTENTS.has(type) ? type : "unknown", payload, suggestion };
}

const VI_HINTS = [
  "canh bao",
  "gia",
  "khung",
  "chi bao",
  "giao cat",
  "duong",
  "xoa",
  "huy",
  "tat ca",
  "them",
  "tao",
  "cho toi",
  "giup",
  "vuot",
  "duoi",
  "tren",
];

const EN_HINTS = [
  "alert",
  "price",
  "timeframe",
  "indicator",
  "cross",
  "delete",
  "remove",
  "create",
  "add",
  "help",
  "menu",
  "above",
  "below",
  "current",
  "chart",
  "these",
];

export function detectUserLanguage(value, fallback = "vi") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(raw)) {
    return "vi";
  }
  const plain = stripDiacritics(raw.toLowerCase());
  const viScore = VI_HINTS.reduce((acc, token) => acc + (plain.includes(token) ? 1 : 0), 0);
  const enScore = EN_HINTS.reduce((acc, token) => acc + (plain.includes(token) ? 1 : 0), 0);
  if (viScore === 0 && enScore === 0) return fallback;
  if (enScore > viScore) return "en";
  return "vi";
}

export function collapseSymbolForMatch(value) {
  const raw = stripDiacritics(String(value || "").trim().toUpperCase());
  const compact = raw
    .replace(/[._\s-]+/g, "")
    .replace(/USDT$/i, "USD");
  // Keep MT5 contracts (USDM) distinct to avoid accidental downgrades.
  if (/USDM$/i.test(compact)) return compact;
  return compact.replace(/M$/i, "");
}
