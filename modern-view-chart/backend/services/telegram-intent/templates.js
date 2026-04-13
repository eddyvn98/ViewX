import {
  normalizeCompareOperator,
  normalizeDirection,
  normalizeSymbol,
  normalizeTimeframe,
  parseIndicatorToken,
  parsePositiveNumber,
} from "./shared.js";

export function parseDeleteIntent(text) {
  const match = text.match(/^(?:\/)?(?:delete|del|xoa|huy)\s+alert\s+([#]?[A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  const ref = String(match[1] || "").trim();
  if (!ref) return null;
  if (ref.startsWith("#")) {
    const index = Number(ref.slice(1));
    if (Number.isFinite(index) && index > 0) return { type: "delete_alert", payload: { by: "index", value: index } };
  }
  if (/^\d+$/.test(ref)) {
    const index = Number(ref);
    if (index > 0) return { type: "delete_alert", payload: { by: "index", value: index } };
  }
  return { type: "delete_alert", payload: { by: "id", value: ref } };
}

export function parsePricePercentIntent(text) {
  const match = text.match(
    /^(?:(?:alert|pp)\s*(?:gia|price)?\s+)?([A-Za-z0-9._-]+)\s+(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)\s+(up|len|tang|vuot|gt|down|xuong|giam|lt)\s+(\d+(?:\.\d+)?)%$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const directionToken = String(match[3] || "").toLowerCase();
  const percent = parsePositiveNumber(match[4]);
  if (!symbol || !timeframe || !percent) return null;
  const direction = ["down", "xuong", "giam", "lt"].includes(directionToken) ? "lt" : "gt";
  return { type: "create_price_alert_percent", payload: { symbol, timeframe, direction, percent } };
}

export function parsePriceAbsoluteIntent(text) {
  const match = text.match(
    /^(?:(?:alert|pa)\s*(?:gia|price)?\s+)?([A-Za-z0-9._-]+)\s+(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/i,
  );
  if (!match) return null;
  const symbol = normalizeSymbol(match[1]);
  const timeframe = normalizeTimeframe(match[2]);
  const operator = normalizeCompareOperator(match[3], ">");
  const targetPrice = parsePositiveNumber(match[4]);
  if (!symbol || !timeframe || !targetPrice) return null;
  return { type: "create_price_alert_absolute", payload: { symbol, timeframe, operator, targetPrice } };
}

export function parseRsiIntent(text) {
  const strictMatch = text.match(
    /^(?:(?:alert\s*)?rsi|ra)\s+([A-Za-z0-9._-]+)\s+(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)(?:\s+(\d{1,3}))?\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/i,
  );
  if (strictMatch) {
    const symbol = normalizeSymbol(strictMatch[1]);
    const timeframe = normalizeTimeframe(strictMatch[2]);
    const period = Math.max(2, Number(strictMatch[3] || 14));
    const operator = normalizeCompareOperator(strictMatch[4], ">");
    const threshold = Number(strictMatch[5]);
    if (!symbol || !timeframe || !Number.isFinite(threshold)) return null;
    return { type: "create_rsi_alert", payload: { symbol, timeframe, period, condition: operator === "<" ? "lt" : "gt", threshold } };
  }

  const natural = text.match(
    /^(?:(?:them|tao|add|create)\s*)?(?:canh\s*bao|alert)\s*rsi(?:\s+([A-Za-z0-9._-]+))?(?:\s+(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240))?(?:\s+(?:period|chu\s*ky)\s*(\d{1,3}))?\s*(tren|lon\s*hon|cao\s*hon|duoi|nho\s*hon|thap\s*hon|>=|>|<=|<)\s*(\d+(?:\.\d+)?)(?:\s*(?:voi|cho)?\s*(?:tat\s*ca|all)\s*(?:symbol|ma|symbols))?$/i,
  );
  if (natural) {
    const allSymbols = /\b(?:tat\s*ca|all)\s*(?:symbol|ma|symbols)\b/i.test(text);
    const symbol = allSymbols ? "__ALL__" : normalizeSymbol(natural[1] || "");
    const timeframe = normalizeTimeframe(natural[2] || "");
    const period = Math.max(2, Number(natural[3] || 14));
    const cmp = String(natural[4] || "").toLowerCase();
    const threshold = Number(natural[5]);
    const condition = /(duoi|nho|thap|<)/i.test(cmp) ? "lt" : "gt";
    if (!Number.isFinite(threshold)) return null;
    return { type: "create_rsi_alert", payload: { symbol, timeframe, period, condition, threshold, allSymbols } };
  }

  const plain = String(text || "").trim();
  if (!/\brsi\b/i.test(plain)) return null;

  const symbolMatch = plain.match(/\b([A-Za-z]{2,10}(?:USD|USDT|USDM)|BTC|ETH|XAUUSD|XAU|VANG|GOLD)\b/i);
  const timeframeMatch = plain.match(/\b(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)\b/i);
  const periodMatch = plain.match(/\b(?:period|chu\s*ky)\s*(\d{1,3})\b/i);
  const compareMatch = plain.match(/(tren|lon\s*hon|cao\s*hon|duoi|nho\s*hon|thap\s*hon|>=|>|<=|<)/i);
  const thresholdMatch = plain.match(/(?:>=|>|<=|<|tren|lon\s*hon|cao\s*hon|duoi|nho\s*hon|thap\s*hon)\s*(\d+(?:\.\d+)?)/i);
  const allSymbols = /\b(?:tat\s*ca|all)\s*(?:symbol|ma|symbols)\b/i.test(plain);
  const symbol = allSymbols ? "__ALL__" : normalizeSymbol(symbolMatch?.[1] || "");
  const timeframe = normalizeTimeframe(timeframeMatch?.[1] || "");
  const period = Math.max(2, Number(periodMatch?.[1] || 14));
  const cmpToken = String(compareMatch?.[1] || "").toLowerCase();
  const threshold = thresholdMatch ? Number(thresholdMatch[1]) : null;
  const condition = /(duoi|nho|thap|<)/i.test(cmpToken) ? "lt" : "gt";

  if (!Number.isFinite(threshold)) return null;
  if (!allSymbols && !symbol) return null;
  if (!timeframe) return null;

  return { type: "create_rsi_alert", payload: { symbol, timeframe, period, condition, threshold, allSymbols } };
}

export function parseMaCrossIntent(text) {
  const match = text.match(
    /^(?:(?:alert|ma)\s*)?(?:ma|moving_average)?\s*([A-Za-z0-9._-]+)\s+(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)\s+([A-Za-z0-9()]+)\s+(?:cross|cat)\s+(up|down|len|xuong|bull|bear)\s+([A-Za-z0-9()]+)$/i,
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
    payload: { symbol, timeframe, fastType: fast.type, fastPeriod: fast.period, slowType: slow.type, slowPeriod: slow.period, direction },
  };
}

export function parseIndicatorIntent(text) {
  const match = text.match(
    /^(?:(?:alert|ia)\s*)?(?:indicator|ind|chi_bao)?\s*([A-Za-z0-9._-]+)\s+(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)\s+([A-Za-z0-9_()]+)\s+(>|<|>=|<=|crosses_above|crosses_below|cross_up|cross_down|cat_len|cat_xuong)\s+([A-Za-z0-9_()]+)$/i,
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
    payload: { symbol, timeframe, leftType: left.type, leftPeriod: left.period, rightType: right.type, rightPeriod: right.period, operator },
  };
}
