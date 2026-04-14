import { parseRuleIntent } from "./rules.js";
import { lookupPhraseMemory, savePhraseMemory } from "./memory.js";
import { parseAiIntent } from "./ai.js";
import {
  detectUserLanguage,
  normalizeCompareOperator,
  normalizeDirection,
  normalizeIntentOutput,
  normalizeSymbol,
  normalizeTimeframe,
  parseIndicatorToken,
  parsePositiveNumber,
  stripDiacritics,
} from "./shared.js";

function isFastCommand(text) {
  const trimmed = String(text || "").trim();
  const plain = stripDiacritics(trimmed).toLowerCase();
  return (
    /^(?:\/)?(?:menu|start|m|mn|help|h|\?|alerts?|list|la|ls|da|clr)$/i.test(trimmed) ||
    /^(?:list\s*alerts?|danh\s*sach\s*(?:canh\s*bao|alerts?)|xem\s*(?:alerts?|canh bao)|show\s*alerts?)$/i.test(plain) ||
    /^(?:remove\s*all\s*alerts?|xoa.{0,16}tat ca.{0,16}(canh bao|alert)|huy.{0,16}tat ca.{0,16}(canh bao|alert))$/i.test(plain)
  );
}

function withMeta(intent, meta = {}) {
  const normalized = normalizeIntentOutput(intent);
  return {
    ...normalized,
    meta: {
      source: meta.source || "unknown",
      lang: meta.lang || "vi",
    },
  };
}

function messageByLang(lang, vi, en) {
  return lang === "en" ? en : vi;
}

function extractTimeframe(text) {
  const match = String(text || "").match(/\b(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|60|240)\b/i);
  return normalizeTimeframe(match?.[1] || "");
}

function extractOperator(text) {
  const plain = stripDiacritics(String(text || "").toLowerCase());
  if (/(crosses_above|cross up|crossup|cat len)/i.test(plain)) return "crosses_above";
  if (/(crosses_below|cross down|crossdown|cat xuong)/i.test(plain)) return "crosses_below";
  if (/(\bgiam\b|\bxuong\b|\broi\b|\bfall\b|\bdrop\b)/i.test(plain)) return "<";
  if (/(<=|<|\bduoi\b|\bnho hon\b|\bthap hon\b|\bbelow\b)/i.test(plain)) return "<";
  if (/(>=|>|\bvuot\b|\btren\b|\blon hon\b|\bcao hon\b|\babove\b)/i.test(plain)) return ">";
  return "";
}

function extractSymbol(text) {
  const normalizedText = stripDiacritics(String(text || "").toUpperCase());
  const compact = normalizedText.replace(/[^A-Z0-9]/g, " ");
  const tokens = compact.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (/^[A-Z]{2,10}(USD|USDT|USDM)$/.test(token)) return normalizeSymbol(token);
    if (/^(BTC|ETH|VANG|GOLD|XAU|XAUUSD|US30|NAS100)$/.test(token)) return normalizeSymbol(token);
  }
  return "";
}

function extractTargetPrice(text) {
  const raw = String(text || "");
  // Prefer numbers that are clearly used as a price condition (>, <, >=, <=, tren/duoi/vuot...).
  const explicit = raw.match(/(?:>=|<=|>|<|tren|duoi|vuot|above|below)\s*(\d+(?:\.\d+)?)/i);
  if (explicit?.[1]) return parsePositiveNumber(explicit[1]);

  // Fallback: collect numeric tokens but ignore timeframe-like values (1m, 15m, h1, h4...).
  const candidates = raw.match(/\d+(?:\.\d+)?/g) || [];
  if (!candidates.length) return null;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const token = String(candidates[index] || "");
    const tokenPos = raw.lastIndexOf(token);
    const suffix = tokenPos >= 0 ? String(raw.slice(tokenPos + token.length, tokenPos + token.length + 1) || "").toLowerCase() : "";
    if (suffix === "m" || suffix === "h") continue;
    return parsePositiveNumber(token);
  }
  return null;
}

function extractThreshold(text) {
  const raw = String(text || "");
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return Number.isFinite(Number(match?.[1])) ? Number(match[1]) : null;
}

function extractPeriod(text, fallback = 14) {
  const raw = String(text || "");
  const match = raw.match(/\b(?:period|chu ky|length)\s*(\d{1,3})\b/i);
  const period = Number(match?.[1] || fallback);
  return Number.isFinite(period) ? Math.max(2, period) : fallback;
}

function extractCrossDirection(text) {
  const raw = String(text || "");
  const normalized = normalizeDirection(raw, "bull");
  return normalized === "bear" ? "bear" : "bull";
}

function extractIndicatorTokens(text) {
  const normalized = stripDiacritics(String(text || "").toLowerCase());
  const matches = normalized.match(/\b(?:price|gia|ema\d*|hma\d*|sma\d*|wma\d*|wema\d*|rsi\d*|macd\d*|atr\d*|adx\d*|cci\d*|roc\d*|trix\d*|mfi\d*|obv\d*|vwap\d*|kst\d*|stochasticrsi\d*|stochastic\d*|williamsr\d*|bollingerbands\d*|bollinger\d*|bb\d*|keltnerchannels\d*|keltner\d*|ichimokucloud\d*|ichimoku\d*|psar\d*|sar\d*)\b/gi) || [];
  return matches
    .map((item) => parseIndicatorToken(item))
    .filter(Boolean);
}

function extractPartialIntent(text) {
  const raw = String(text || "").trim();
  const plain = stripDiacritics(raw.toLowerCase());
  if (!raw) return null;

  const symbol = extractSymbol(raw);
  const timeframe = extractTimeframe(raw);
  const operator = extractOperator(raw);
  const targetPrice = extractTargetPrice(raw);
  const threshold = extractThreshold(raw);
  const indicators = extractIndicatorTokens(raw);
  const allSymbols = /\b(?:tat\s*ca|all)\s*(?:symbol|ma|symbols)\b/i.test(plain);

  if (/(?:2 duong nay|hai duong nay|these two indicators|current indicators|indicator dang bat|indicator tren web|indicator on web|chart web|current chart)/i.test(plain)) {
    return {
      intent: "create_web_indicator_alert",
      timeframe,
      symbol,
      operator: operator || "crosses_above",
      mode: /(?:2 duong nay|hai duong nay|these two indicators)/i.test(plain) ? "active_pair" : "web_pair",
    };
  }

  if (/(?:rsi)\b/i.test(plain) && (threshold != null || symbol || timeframe)) {
    return {
      intent: "create_rsi_alert",
      symbol: allSymbols ? "__ALL__" : symbol,
      timeframe,
      period: extractPeriod(raw, 14),
      condition: normalizeDirection(operator || raw, "bull") === "bear" || operator === "<" ? "lt" : "gt",
      threshold,
      allSymbols,
    };
  }

  if ((/indicator|chi bao|ema|hma|sma|macd|rsi|price|gia/i.test(plain)) && indicators.length >= 2) {
    const [left, right] = indicators;
    if (left?.type === "PRICE" && right?.type === "PRICE") {
      // Ignore "price vs price" pseudo-indicator detection caused by repeated words like "gia ... gia ..."
    } else {
    const hasExplicitCross = /(?:cross|cat)/i.test(plain);
    if (!hasExplicitCross || /(?:indicator|chi bao)/i.test(plain)) {
      return {
        intent: "create_indicator_alert",
        symbol,
        timeframe,
        leftType: left?.type,
        leftPeriod: left?.period,
        rightType: right?.type,
        rightPeriod: right?.period,
        operator: operator || ">",
      };
    }
    }
  }

  if (/(?:cross|cat)/i.test(plain) && indicators.length >= 2 && (symbol || timeframe || /(?:ma|ema|hma)/i.test(plain))) {
    const [fast, slow] = indicators;
    return {
      intent: "create_ma_cross_alert",
      symbol,
      timeframe,
      fastType: fast?.type,
      fastPeriod: fast?.period,
      slowType: slow?.type,
      slowPeriod: slow?.period,
      direction: extractCrossDirection(raw),
    };
  }

  if ((/indicator|chi bao|ema|hma|sma|macd|rsi|price|gia/i.test(plain)) && indicators.length >= 2) {
    const [left, right] = indicators;
    if (left?.type === "PRICE" && right?.type === "PRICE") {
      // Ignore "price vs price" pseudo-indicator detection caused by repeated words like "gia ... gia ..."
    } else {
    return {
      intent: "create_indicator_alert",
      symbol,
      timeframe,
      leftType: left?.type,
      leftPeriod: left?.period,
      rightType: right?.type,
      rightPeriod: right?.period,
      operator: operator || ">",
    };
    }
  }

  if (/(canh bao|alert|gia|price|vuot|tren|duoi|muc|level)/i.test(plain)) {
    const inferredTargetPrice = (symbol || timeframe) ? targetPrice : null;
    const payload = {
      intent: "create_price_alert_absolute",
      symbol,
      timeframe,
      operator: operator || ">",
      targetPrice: inferredTargetPrice,
    };
    const isPriceAlertSeed = /(canh bao|alert)/i.test(plain) && /(gia|price)/i.test(plain);
    if (payload.symbol || payload.timeframe || payload.targetPrice || isPriceAlertSeed) return payload;
  }

  if (symbol && timeframe) return { symbol, timeframe };
  if (timeframe) return { timeframe };
  if (symbol) return { symbol };
  if (targetPrice && operator) return { targetPrice, operator };
  return null;
}

function buildSuggestionForPending(payload, lang) {
  if (!payload || typeof payload !== "object") return null;
  const type = String(payload.intent || payload.type || "").trim().toLowerCase();

  if (type === "create_price_alert_absolute") {
    if (!payload.symbol) return messageByLang(lang, "Bạn muốn đặt cảnh báo cho mã nào?", "Which symbol should I create the alert for?");
    if (!payload.targetPrice) return messageByLang(lang, "Bạn muốn cảnh báo ở mức giá bao nhiêu?", "What target price should I use?");
    if (!payload.timeframe) return messageByLang(lang, "Bạn muốn dùng khung thời gian nào? Ví dụ: 5m, 15m, 1h hoặc 4h.", "Which timeframe should I use? For example: 5m, 15m, 1h, or 4h.");
  }

  if (type === "create_rsi_alert") {
    if (!payload.allSymbols && !payload.symbol) return messageByLang(lang, "Bạn muốn RSI của mã nào?", "Which symbol should I use for the RSI alert?");
    if (payload.threshold == null) return messageByLang(lang, "Bạn muốn cảnh báo RSI ở ngưỡng nào?", "What RSI threshold should I use?");
    if (!payload.timeframe) return messageByLang(lang, "Bạn muốn dùng RSI ở khung thời gian nào?", "Which timeframe should I use for RSI?");
  }

  if (type === "create_ma_cross_alert") {
    if (!payload.symbol) return messageByLang(lang, "Bạn muốn tạo MA cross cho mã nào?", "Which symbol should I use for the MA cross alert?");
    if (!payload.timeframe) return messageByLang(lang, "Bạn muốn dùng khung thời gian nào cho MA cross?", "Which timeframe should I use for the MA cross alert?");
    if (!payload.fastType || !payload.slowType || !payload.fastPeriod || !payload.slowPeriod) {
      return messageByLang(lang, "Bạn muốn cặp MA nào? Ví dụ: EMA20 cắt lên EMA50.", "Which moving-average pair should I use? Example: EMA20 crossing above EMA50.");
    }
  }

  if (type === "create_indicator_alert") {
    if (!payload.symbol) return messageByLang(lang, "Bạn muốn cảnh báo indicator cho mã nào?", "Which symbol should I use for the indicator alert?");
    if (!payload.timeframe) return messageByLang(lang, "Bạn muốn dùng khung thời gian nào cho indicator alert?", "Which timeframe should I use for the indicator alert?");
    if (!payload.leftType || !payload.rightType) {
      return messageByLang(lang, "Bạn muốn so sánh cặp indicator nào? Ví dụ: EMA20 > EMA50 hoặc MACD cắt lên PRICE.", "Which indicator pair should I compare? Example: EMA20 > EMA50 or MACD crossing above PRICE.");
    }
  }

  if (type === "create_web_indicator_alert") {
    if (!payload.timeframe) {
      return messageByLang(lang, "Bạn muốn lấy theo khung nào trên web? Nếu bỏ trống, bot sẽ dùng khung đang mở.", "Which timeframe should I use from the web chart? If you skip it, I will use the active chart timeframe.");
    }
  }

  return null;
}

function finalizeMergedIntent(merged) {
  const type = String(merged.intent || merged.type || "").trim().toLowerCase();
  if (type === "create_price_alert_absolute") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(merged.symbol || ""),
        timeframe: normalizeTimeframe(merged.timeframe || ""),
        operator: normalizeCompareOperator(merged.operator || ">", ">"),
        targetPrice: parsePositiveNumber(merged.targetPrice),
      },
    });
    const p = normalized.payload || {};
    if (p.symbol && p.timeframe && p.targetPrice && [">", "<"].includes(p.operator)) return normalized;
  }

  if (type === "create_rsi_alert") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: merged.allSymbols ? "__ALL__" : normalizeSymbol(merged.symbol || ""),
        timeframe: normalizeTimeframe(merged.timeframe || ""),
        period: Math.max(2, Number(merged.period || 14)),
        condition: merged.condition === "lt" ? "lt" : "gt",
        threshold: merged.threshold == null ? null : Number(merged.threshold),
        allSymbols: Boolean(merged.allSymbols),
      },
    });
    const p = normalized.payload || {};
    if ((p.allSymbols || p.symbol) && p.timeframe && Number.isFinite(p.threshold)) return normalized;
  }

  if (type === "create_ma_cross_alert") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(merged.symbol || ""),
        timeframe: normalizeTimeframe(merged.timeframe || ""),
        fastType: merged.fastType ? String(merged.fastType).toUpperCase() : "",
        fastPeriod: Math.max(2, Number(merged.fastPeriod || 0)),
        slowType: merged.slowType ? String(merged.slowType).toUpperCase() : "",
        slowPeriod: Math.max(2, Number(merged.slowPeriod || 0)),
        direction: merged.direction === "bear" ? "bear" : "bull",
      },
    });
    const p = normalized.payload || {};
    if (p.symbol && p.timeframe && p.fastType && p.slowType && p.fastPeriod && p.slowPeriod) return normalized;
  }

  if (type === "create_indicator_alert") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(merged.symbol || ""),
        timeframe: normalizeTimeframe(merged.timeframe || ""),
        leftType: merged.leftType ? String(merged.leftType).toUpperCase() : "",
        leftPeriod: Math.max(0, Number(merged.leftPeriod || 0)),
        rightType: merged.rightType ? String(merged.rightType).toUpperCase() : "",
        rightPeriod: Math.max(0, Number(merged.rightPeriod || 0)),
        operator: normalizeCompareOperator(merged.operator || ">", ">"),
      },
    });
    const p = normalized.payload || {};
    if (p.symbol && p.timeframe && p.leftType && p.rightType && p.operator) return normalized;
  }

  if (type === "create_web_indicator_alert") {
    return normalizeIntentOutput({
      type,
      payload: {
        mode: merged.mode || "web_pair",
        symbol: normalizeSymbol(merged.symbol || ""),
        timeframe: normalizeTimeframe(merged.timeframe || ""),
        operator: normalizeCompareOperator(merged.operator || "crosses_above", "crosses_above"),
      },
    });
  }

  return null;
}

function mergePendingIntent(pendingIntent, text, lang) {
  if (!pendingIntent || typeof pendingIntent !== "object") return null;
  const pendingType = String(pendingIntent.intent || pendingIntent.type || "").trim().toLowerCase();
  if (
    pendingType === "create_indicator_alert" &&
    String(pendingIntent.leftType || "").toUpperCase() === "PRICE" &&
    String(pendingIntent.rightType || "").toUpperCase() === "PRICE"
  ) {
    // Guard against stale/invalid pending generated by older parser versions.
    return null;
  }
  let partial = extractPartialIntent(text);
  // Support slot-filling replies like "4772" while waiting for absolute price alert fields.
  if (!partial && pendingType === "create_price_alert_absolute") {
    const raw = String(text || "").trim();
    const priceOnly = raw.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
    const priceWithOperator = raw.match(/^\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)\s*$/);
    if (priceWithOperator) {
      partial = {
        operator: normalizeCompareOperator(priceWithOperator[1], ">"),
        targetPrice: parsePositiveNumber(priceWithOperator[2]),
      };
    } else if (priceOnly) {
      partial = {
        targetPrice: parsePositiveNumber(priceOnly[1]),
      };
    }
  }
  if (!partial) return null;

  const merged = { ...pendingIntent, ...partial };
  const finalized = finalizeMergedIntent(merged);
  if (finalized) return finalized;

  return normalizeIntentOutput({
    type: "unknown",
    payload: { ...merged, intent: merged.intent || merged.type, _lang: lang },
    suggestion: buildSuggestionForPending(merged, lang),
  });
}

function inferUnknownIntent(text, lang) {
  const partial = extractPartialIntent(text);
  if (!partial?.intent) return null;
  const finalized = finalizeMergedIntent(partial);
  if (finalized) {
    return withMeta(finalized, { source: "partial_finalize", lang });
  }
  partial._lang = lang;
  return withMeta(
    {
      type: "unknown",
      payload: partial,
      suggestion: buildSuggestionForPending(partial, lang),
    },
    { source: "pending_seed", lang },
  );
}

export async function resolveTelegramIntent({ text, pendingIntent = null, userId = "" }) {
  const lang = detectUserLanguage(text, String(pendingIntent?._lang || "").trim().toLowerCase() || detectUserLanguage(JSON.stringify(pendingIntent || {}), "vi"));

  const mergedPending = mergePendingIntent(pendingIntent, text, lang);
  if (mergedPending) {
    if (mergedPending.type !== "unknown" && userId) await savePhraseMemory(userId, text, mergedPending).catch(() => null);
    return withMeta(mergedPending, { source: "pending_merge", lang });
  }

  const byRule = parseRuleIntent(text);
  const fastCommand = isFastCommand(text);
  if (fastCommand && byRule.type !== "unknown") {
    if (userId) await savePhraseMemory(userId, text, byRule).catch(() => null);
    return withMeta(byRule, { source: "rule_fast", lang });
  }

  const byMemory = userId ? await lookupPhraseMemory(userId, text).catch(() => null) : null;
  if (byMemory && byMemory.type !== "unknown" && fastCommand) return withMeta(byMemory, { source: "memory_fast", lang });

  const byAi = await parseAiIntent(text, pendingIntent).catch(() => null);
  if (byAi) {
    if (byAi.type === "unknown") {
      const inferredFromText = inferUnknownIntent(text, lang);
      if (inferredFromText && inferredFromText.type !== "unknown") {
        return withMeta(inferredFromText, { source: "ai_corrected_by_partial", lang });
      }
      if (inferredFromText?.payload?.intent && !byAi?.payload?.intent) {
        return withMeta(inferredFromText, { source: "ai_unknown_partial", lang });
      }
      return withMeta({ ...byAi, suggestion: byAi.suggestion || buildSuggestionForPending(byAi.payload, lang) }, { source: "ai", lang });
    }
    if (userId) await savePhraseMemory(userId, text, byAi).catch(() => null);
    return withMeta(byAi, { source: "ai", lang });
  }

  if (byRule.type !== "unknown") {
    if (userId) await savePhraseMemory(userId, text, byRule).catch(() => null);
    return withMeta(byRule, { source: "rule_fallback", lang });
  }

  if (byMemory && byMemory.type !== "unknown") return withMeta(byMemory, { source: "memory_fallback", lang });

  const inferred = inferUnknownIntent(text, lang);
  if (inferred) return inferred;

  return withMeta(byRule, { source: "fallback_unknown", lang });
}
