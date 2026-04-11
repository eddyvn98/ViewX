const TIMEFRAME_OPTIONS = new Set(["1m", "5m", "15m", "1h", "4h"]);
const ALERT_INTENTS = new Set([
  "show_menu",
  "help",
  "list_alerts",
  "delete_alert",
  "create_price_alert_percent",
  "create_price_alert_absolute",
  "create_rsi_alert",
  "create_ma_cross_alert",
  "create_indicator_alert",
  "unknown",
]);

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTimeframe(value) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = raw === "60" ? "1h" : raw === "240" ? "4h" : raw;
  return TIMEFRAME_OPTIONS.has(normalized) ? normalized : "";
}

function normalizeCompareOperator(value, fallback = ">") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === ">" || raw === ">=") return ">";
  if (raw === "<" || raw === "<=") return "<";
  if (raw === "crosses_above" || raw === "cross_up" || raw === "crossup" || raw === "cat_len") return "crosses_above";
  if (raw === "crosses_below" || raw === "cross_down" || raw === "crossdown" || raw === "cat_xuong") return "crosses_below";
  return fallback;
}

function normalizeDirection(value, fallback = "bull") {
  const raw = String(value || "").trim().toLowerCase();
  if (["bear", "down", "below", "xuong", "giam", "lt"].includes(raw)) return "bear";
  if (["bull", "up", "above", "len", "tang", "gt"].includes(raw)) return "bull";
  return fallback;
}

function parsePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseIndicatorToken(rawValue) {
  const raw = String(rawValue || "").trim().toUpperCase().replaceAll(" ", "");
  if (!raw) return null;
  if (raw === "PRICE" || raw === "GIA") {
    return { type: "PRICE", period: 0 };
  }
  const compact = raw.replaceAll("(", "").replaceAll(")", "");
  const match = compact.match(/^([A-Z_]{2,24})(\d{1,4})?$/);
  if (!match) return null;
  const type = match[1];
  const period = match[2] ? Math.max(2, Number(match[2])) : 0;
  if (!Number.isFinite(period) && type !== "PRICE") return null;
  return { type, period };
}

function parseDeleteIntent(text) {
  const match = text.match(/^(?:\/)?(?:delete|del|xoa|huy)\s+alert\s+([#]?[A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  const ref = String(match[1] || "").trim();
  if (!ref) return null;
  if (ref.startsWith("#")) {
    const index = Number(ref.slice(1));
    if (Number.isFinite(index) && index > 0) {
      return { type: "delete_alert", payload: { by: "index", value: index } };
    }
  }
  if (/^\d+$/.test(ref)) {
    const index = Number(ref);
    if (index > 0) {
      return { type: "delete_alert", payload: { by: "index", value: index } };
    }
  }
  return { type: "delete_alert", payload: { by: "id", value: ref } };
}

function parsePricePercentIntent(text) {
  const match = text.match(
    /^(?:alert\s*(?:gia|price)\s+)?([A-Za-z0-9._-]+)\s+(1m|5m|15m|1h|4h|60|240)\s+(up|len|tang|vuot|gt|down|xuong|giam|lt)\s+(\d+(?:\.\d+)?)%$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const directionToken = String(match[3] || "").toLowerCase();
  const percent = parsePositiveNumber(match[4]);
  if (!symbol || !timeframe || !percent) return null;
  const direction = ["down", "xuong", "giam", "lt"].includes(directionToken) ? "lt" : "gt";
  return {
    type: "create_price_alert_percent",
    payload: { symbol, timeframe, direction, percent },
  };
}

function parsePriceAbsoluteIntent(text) {
  const match = text.match(
    /^(?:alert\s*(?:gia|price)\s+)?([A-Za-z0-9._-]+)\s+(1m|5m|15m|1h|4h|60|240)\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const operator = normalizeCompareOperator(match[3], ">");
  const targetPrice = parsePositiveNumber(match[4]);
  if (!symbol || !timeframe || !targetPrice) return null;
  return {
    type: "create_price_alert_absolute",
    payload: { symbol, timeframe, operator, targetPrice },
  };
}

function parseRsiIntent(text) {
  const match = text.match(
    /^(?:alert\s*)?rsi\s+([A-Za-z0-9._-]+)\s+(1m|5m|15m|1h|4h|60|240)(?:\s+(\d{1,3}))?\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const period = Math.max(2, Number(match[3] || 14));
  const operator = normalizeCompareOperator(match[4], ">");
  const threshold = Number(match[5]);
  if (!symbol || !timeframe || !Number.isFinite(threshold)) return null;
  return {
    type: "create_rsi_alert",
    payload: {
      symbol,
      timeframe,
      period,
      condition: operator === "<" ? "lt" : "gt",
      threshold,
    },
  };
}

function parseMaCrossIntent(text) {
  const match = text.match(
    /^(?:alert\s*)?(?:ma|moving_average)\s+([A-Za-z0-9._-]+)\s+(1m|5m|15m|1h|4h|60|240)\s+([A-Za-z0-9()]+)\s+(?:cross|cat)\s+(up|down|len|xuong|bull|bear)\s+([A-Za-z0-9()]+)$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const fast = parseIndicatorToken(match[3]);
  const direction = normalizeDirection(match[4], "bull");
  const slow = parseIndicatorToken(match[5]);
  if (!symbol || !timeframe || !fast || !slow) return null;
  if (!["EMA", "HMA"].includes(fast.type) || !["EMA", "HMA"].includes(slow.type)) return null;
  if (!fast.period || !slow.period) return null;
  return {
    type: "create_ma_cross_alert",
    payload: {
      symbol,
      timeframe,
      fastType: fast.type,
      fastPeriod: fast.period,
      slowType: slow.type,
      slowPeriod: slow.period,
      direction,
    },
  };
}

function parseIndicatorIntent(text) {
  const match = text.match(
    /^(?:alert\s*)?(?:indicator|ind|chi_bao)\s+([A-Za-z0-9._-]+)\s+(1m|5m|15m|1h|4h|60|240)\s+([A-Za-z0-9_()]+)\s+(>|<|>=|<=|crosses_above|crosses_below|cross_up|cross_down|cat_len|cat_xuong)\s+([A-Za-z0-9_()]+)$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const left = parseIndicatorToken(match[3]);
  const operator = normalizeCompareOperator(match[4], ">");
  const right = parseIndicatorToken(match[5]);
  if (!symbol || !timeframe || !left || !right) return null;
  return {
    type: "create_indicator_alert",
    payload: {
      symbol,
      timeframe,
      leftType: left.type,
      leftPeriod: left.period,
      rightType: right.type,
      rightPeriod: right.period,
      operator,
    },
  };
}

function parseRuleIntent(text) {
  const trimmed = String(text || "").trim();
  const plain = stripDiacritics(trimmed).toLowerCase();
  if (!trimmed) return { type: "unknown", payload: {} };

  if (/^(?:\/)?(?:menu|start)$/i.test(trimmed)) return { type: "show_menu", payload: {} };
  if (/^(?:\/)?(?:help|trogiup|huongdan)$/i.test(trimmed) || /^(?:\/)?(?:help|tro giup|huong dan)$/i.test(plain)) {
    return { type: "help", payload: {} };
  }
  if (/^(?:\/)?(?:alerts?|list)$/i.test(trimmed) || /^(?:danh\s*sach|list)\s*alerts?$/i.test(plain)) {
    return { type: "list_alerts", payload: {} };
  }

  const deleteIntent = parseDeleteIntent(trimmed);
  if (deleteIntent) return deleteIntent;

  const maIntent = parseMaCrossIntent(trimmed);
  if (maIntent) return maIntent;

  const rsiIntent = parseRsiIntent(trimmed);
  if (rsiIntent) return rsiIntent;

  const indicatorIntent = parseIndicatorIntent(trimmed);
  if (indicatorIntent) return indicatorIntent;

  const priceAbsoluteIntent = parsePriceAbsoluteIntent(trimmed);
  if (priceAbsoluteIntent) return priceAbsoluteIntent;

  const pricePercentIntent = parsePricePercentIntent(trimmed);
  if (pricePercentIntent) return pricePercentIntent;

  return { type: "unknown", payload: {} };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const codeFence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (codeFence?.[1]) return codeFence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return "";
  return raw.slice(start, end + 1);
}

function normalizeAiIntent(rawIntent) {
  const intent = rawIntent && typeof rawIntent === "object" ? rawIntent : {};
  const type = String(intent.intent || intent.type || "unknown").trim();
  if (!ALERT_INTENTS.has(type)) return { type: "unknown", payload: {} };

  const payload = intent.payload && typeof intent.payload === "object" ? intent.payload : {};
  if (type === "create_price_alert_percent") {
    const symbol = normalizeSymbol(payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    const direction = String(payload.direction || "").toLowerCase() === "lt" ? "lt" : "gt";
    const percent = parsePositiveNumber(payload.percent);
    if (!symbol || !timeframe || !percent) return { type: "unknown", payload: {} };
    return { type, payload: { symbol, timeframe, direction, percent } };
  }

  if (type === "create_price_alert_absolute") {
    const symbol = normalizeSymbol(payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    const operator = normalizeCompareOperator(payload.operator || payload.condition, ">");
    const targetPrice = parsePositiveNumber(payload.targetPrice || payload.price);
    if (!symbol || !timeframe || !targetPrice) return { type: "unknown", payload: {} };
    return { type, payload: { symbol, timeframe, operator, targetPrice } };
  }

  if (type === "create_rsi_alert") {
    const symbol = normalizeSymbol(payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    const period = Math.max(2, Number(payload.period || 14));
    const condition = String(payload.condition || "").toLowerCase() === "lt" ? "lt" : "gt";
    const threshold = Number(payload.threshold);
    if (!symbol || !timeframe || !Number.isFinite(threshold)) return { type: "unknown", payload: {} };
    return { type, payload: { symbol, timeframe, period, condition, threshold } };
  }

  if (type === "create_ma_cross_alert") {
    const symbol = normalizeSymbol(payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    const fastType = String(payload.fastType || "").toUpperCase();
    const slowType = String(payload.slowType || "").toUpperCase();
    const fastPeriod = Math.max(2, Number(payload.fastPeriod || 0));
    const slowPeriod = Math.max(2, Number(payload.slowPeriod || 0));
    const direction = normalizeDirection(payload.direction, "bull");
    if (!symbol || !timeframe || !["EMA", "HMA"].includes(fastType) || !["EMA", "HMA"].includes(slowType)) {
      return { type: "unknown", payload: {} };
    }
    if (!Number.isFinite(fastPeriod) || !Number.isFinite(slowPeriod)) return { type: "unknown", payload: {} };
    return { type, payload: { symbol, timeframe, fastType, fastPeriod, slowType, slowPeriod, direction } };
  }

  if (type === "create_indicator_alert") {
    const symbol = normalizeSymbol(payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    const left = parseIndicatorToken(`${payload.leftType || ""}${Number(payload.leftPeriod || 0) || ""}`) || parseIndicatorToken(payload.leftType);
    const right = parseIndicatorToken(`${payload.rightType || ""}${Number(payload.rightPeriod || 0) || ""}`) || parseIndicatorToken(payload.rightType);
    const operator = normalizeCompareOperator(payload.operator, ">");
    if (!symbol || !timeframe || !left || !right) return { type: "unknown", payload: {} };
    return {
      type,
      payload: {
        symbol,
        timeframe,
        leftType: left.type,
        leftPeriod: left.period,
        rightType: right.type,
        rightPeriod: right.period,
        operator,
      },
    };
  }

  if (type === "delete_alert") {
    if (payload.by === "index") {
      const index = Number(payload.value);
      if (Number.isFinite(index) && index > 0) {
        return { type, payload: { by: "index", value: index } };
      }
    }
    const value = String(payload.value || "").trim();
    if (!value) return { type: "unknown", payload: {} };
    return { type, payload: { by: "id", value } };
  }

  if (type === "show_menu" || type === "help" || type === "list_alerts") {
    return { type, payload: {} };
  }

  return { type: "unknown", payload: {} };
}

async function parseAiIntent(text) {
  const aiToggle = String(process.env.TELEGRAM_BOT_AI_ENABLED || "").trim().toLowerCase();
  const explicitlyDisabled = ["0", "false", "off", "no"].includes(aiToggle);
  if (explicitlyDisabled) return null;
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  const model = String(process.env.TELEGRAM_AI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

  const prompt = [
    "Extract trading alert intent from the user text.",
    "Return JSON only with keys: intent, payload.",
    "Allowed intent values:",
    "show_menu, help, list_alerts, delete_alert, create_price_alert_percent, create_price_alert_absolute, create_rsi_alert, create_ma_cross_alert, create_indicator_alert, unknown.",
    "Payload shape examples:",
    '{"intent":"create_price_alert_percent","payload":{"symbol":"BTCUSDT","timeframe":"5m","direction":"gt","percent":1}}',
    '{"intent":"create_price_alert_absolute","payload":{"symbol":"BTCUSDT","timeframe":"5m","operator":">","targetPrice":70000}}',
    '{"intent":"create_rsi_alert","payload":{"symbol":"BTCUSDT","timeframe":"15m","period":14,"condition":"lt","threshold":30}}',
    '{"intent":"create_ma_cross_alert","payload":{"symbol":"BTCUSDT","timeframe":"1h","fastType":"EMA","fastPeriod":20,"slowType":"EMA","slowPeriod":50,"direction":"bull"}}',
    '{"intent":"create_indicator_alert","payload":{"symbol":"BTCUSDT","timeframe":"1h","leftType":"EMA","leftPeriod":20,"operator":"crosses_above","rightType":"EMA","rightPeriod":50}}',
    '{"intent":"delete_alert","payload":{"by":"index","value":2}}',
    "Use timeframe only in: 1m,5m,15m,1h,4h.",
    "Use operator only: >, <, crosses_above, crosses_below.",
    "If unclear, return unknown.",
    `User text: ${text}`,
  ].join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOut) return null;
  const jsonText = extractJsonObject(textOut);
  if (!jsonText) return null;
  const parsed = JSON.parse(jsonText);
  const normalized = normalizeAiIntent(parsed);
  return normalized.type === "unknown" ? null : normalized;
}

export async function parseTelegramIntent(text) {
  try {
    const byAi = await parseAiIntent(text);
    if (byAi) return byAi;
  } catch {
    // Fall through to deterministic parser below.
  }
  return parseRuleIntent(text);
}
