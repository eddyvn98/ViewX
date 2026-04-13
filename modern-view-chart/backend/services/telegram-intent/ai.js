import {
  ALERT_INTENTS,
  normalizeCompareOperator,
  normalizeDirection,
  normalizeIntentOutput,
  normalizeSymbol,
  normalizeTimeframe,
  parseIndicatorToken,
  parsePositiveNumber,
} from "./shared.js";

let geminiModelCache = { fetchedAt: 0, names: [] };

async function resolveGeminiRuntimeModel(apiKey, requestedModel) {
  const now = Date.now();
  if (!geminiModelCache.names.length || now - geminiModelCache.fetchedAt > 10 * 60 * 1000) {
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      const listJson = await listRes.json().catch(() => ({}));
      const names = Array.isArray(listJson?.models)
        ? listJson.models.map((m) => String(m?.name || "")).filter(Boolean).map((x) => x.replace(/^models\//i, ""))
        : [];
      if (names.length) geminiModelCache = { fetchedAt: now, names };
    } catch {}
  }
  const available = geminiModelCache.names || [];
  if (!available.length || available.includes(requestedModel)) return requestedModel;
  const fallback = String(process.env.GEMINI_MODEL || "").trim();
  if (fallback && available.includes(fallback)) return fallback;
  if (available.includes("gemma-4-26b-a4b-it")) return "gemma-4-26b-a4b-it";
  if (available.includes("gemma-4-31b-it")) return "gemma-4-31b-it";
  if (available.includes("gemini-2.5-flash")) return "gemini-2.5-flash";
  return available[0] || requestedModel;
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return raw.slice(start, end + 1);
}

function extractGeminiTextResponse(data) {
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];
  if (!parts.length) return "";
  const textParts = parts
    .filter((part) => !part?.thought && typeof part?.text === "string" && part.text.trim())
    .map((part) => part.text.trim());
  if (textParts.length) return textParts.join("\n");
  const fallback = parts.find((part) => typeof part?.text === "string" && part.text.trim());
  return fallback?.text?.trim() || "";
}

function normalizeAiIntent(rawIntent) {
  const intent = rawIntent && typeof rawIntent === "object" ? rawIntent : {};
  let type = String(intent.intent || intent.type || "unknown").trim().toLowerCase();
  if (!ALERT_INTENTS.has(type)) {
    if (type.includes("price") && type.includes("percent")) type = "create_price_alert_percent";
    else if (type.includes("price")) type = "create_price_alert_absolute";
    else if (type.includes("rsi")) type = "create_rsi_alert";
    else if (type.includes("ma") && type.includes("cross")) type = "create_ma_cross_alert";
    else if (type.includes("indicator") || type.includes("rule")) type = "create_indicator_alert";
    else if (type.includes("delete") && type.includes("all")) type = "delete_all_alerts";
    else if (type.includes("delete") || type.includes("xoa") || type.includes("huy")) type = "delete_alert";
    else if (type.includes("list") || type.includes("alerts")) type = "list_alerts";
    else if (type.includes("menu") || type.includes("start")) type = "show_menu";
    else if (type.includes("help")) type = "help";
    else if (type.includes("matrix") || type.includes("scanner")) type = "show_scanner_matrix";
  }

  const payload = intent.payload && typeof intent.payload === "object" ? intent.payload : intent;
  const missingFields = Array.isArray(intent.missing_fields)
    ? intent.missing_fields.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const getAt = (keys, fallback = null) => {
    for (const k of keys) {
      if (payload[k] !== undefined && payload[k] !== null) return payload[k];
      if (intent[k] !== undefined && intent[k] !== null) return intent[k];
    }
    return fallback;
  };

  if (type === "create_price_alert_percent") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(getAt(["symbol", "asset", "pair", "coin", "ticker"])),
        timeframe: normalizeTimeframe(getAt(["timeframe", "tf", "interval", "khung"])),
        direction: normalizeDirection(getAt(["direction", "side"]), "bull") === "bear" ? "lt" : "gt",
        percent: parsePositiveNumber(getAt(["percent", "percentage", "value"])),
      },
      suggestion: intent.suggestion,
    });
    const p = normalized.payload || {};
    if (!p.symbol || !p.timeframe || !p.percent || !["gt", "lt"].includes(p.direction)) {
      return normalizeIntentOutput({
        type: "unknown",
        payload: { intent: type, ...normalized.payload, missing_fields: missingFields },
        suggestion: intent.suggestion,
      });
    }
    return normalized;
  }
  if (type === "create_price_alert_absolute") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(getAt(["symbol", "asset", "pair", "coin", "ticker"])),
        timeframe: normalizeTimeframe(getAt(["timeframe", "tf", "interval", "khung"])),
        operator: normalizeCompareOperator(getAt(["operator", "condition", "op"]), ">"),
        targetPrice: parsePositiveNumber(getAt(["targetPrice", "price", "value", "target"])),
      },
      suggestion: intent.suggestion,
    });
    const p = normalized.payload || {};
    if (!p.symbol || !p.timeframe || !p.targetPrice || ![">", "<"].includes(p.operator)) {
      return normalizeIntentOutput({
        type: "unknown",
        payload: { intent: type, ...normalized.payload, missing_fields: missingFields },
        suggestion: intent.suggestion,
      });
    }
    return normalized;
  }
  if (type === "create_rsi_alert") {
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(getAt(["symbol", "asset", "pair", "coin", "ticker"])),
        timeframe: normalizeTimeframe(getAt(["timeframe", "tf", "interval", "khung"])),
        period: Math.max(2, Number(getAt(["period", "len", "length"], 14))),
        condition: normalizeDirection(getAt(["condition", "operator", "side"]), "bull") === "bear" ? "lt" : "gt",
        threshold: Number(getAt(["threshold", "value", "level"])),
      },
      suggestion: intent.suggestion,
    });
    const p = normalized.payload || {};
    if ((!p.symbol && !Boolean(payload.allSymbols || intent.allSymbols)) || !p.timeframe || !Number.isFinite(p.threshold) || !["gt", "lt"].includes(p.condition)) {
      return normalizeIntentOutput({
        type: "unknown",
        payload: { intent: type, ...normalized.payload, allSymbols: Boolean(payload.allSymbols || intent.allSymbols), missing_fields: missingFields },
        suggestion: intent.suggestion,
      });
    }
    return normalized;
  }
  if (type === "create_ma_cross_alert") {
    return normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(getAt(["symbol", "asset", "pair", "coin", "ticker"])),
        timeframe: normalizeTimeframe(getAt(["timeframe", "tf", "interval", "khung"])),
        fastType: String(getAt(["fastType", "fast_type"], "EMA")).toUpperCase(),
        slowType: String(getAt(["slowType", "slow_type"], "EMA")).toUpperCase(),
        fastPeriod: Math.max(2, Number(getAt(["fastPeriod", "fast_len", "period1"], 9))),
        slowPeriod: Math.max(2, Number(getAt(["slowPeriod", "slow_len", "period2"], 20))),
        direction: normalizeDirection(getAt(["direction", "side"]), "bull"),
      },
      suggestion: intent.suggestion,
    });
  }
  if (type === "create_indicator_alert") {
    const left = parseIndicatorToken(`${getAt(["leftType", "left", "indicator1"], "")}${getAt(["leftPeriod", "period1"], "")}`);
    const right = parseIndicatorToken(`${getAt(["rightType", "right", "indicator2"], "")}${getAt(["rightPeriod", "period2"], "")}`);
    const normalized = normalizeIntentOutput({
      type,
      payload: {
        symbol: normalizeSymbol(getAt(["symbol", "asset", "pair", "coin", "ticker"])),
        timeframe: normalizeTimeframe(getAt(["timeframe", "tf", "interval", "khung"])),
        leftType: left?.type,
        leftPeriod: left?.period,
        rightType: right?.type,
        rightPeriod: right?.period,
        operator: normalizeCompareOperator(getAt(["operator", "op", "condition"], ">")),
      },
      suggestion: intent.suggestion,
    });
    const p = normalized.payload || {};
    if (!p.symbol || !p.timeframe || !p.leftType || !p.rightType || !p.operator) {
      return normalizeIntentOutput({
        type: "unknown",
        payload: { intent: type, ...normalized.payload, missing_fields: missingFields },
        suggestion: intent.suggestion,
      });
    }
    return normalized;
  }
  if (type === "delete_alert") {
    if (payload.by === "index" || payload.index || payload.idx) {
      const index = Number(getAt(["value", "index", "idx"]));
      return normalizeIntentOutput({ type, payload: Number.isFinite(index) && index > 0 ? { by: "index", value: index } : {} });
    }
    return normalizeIntentOutput({ type, payload: { by: "id", value: String(getAt(["value", "id", "alert_id"], "")).trim() } });
  }
  return normalizeIntentOutput({ type, payload, suggestion: intent.suggestion });
}

export async function parseAiIntent(text, pendingIntent = null) {
  const aiToggle = String(process.env.TELEGRAM_BOT_AI_ENABLED || process.env.AI_ENABLED || "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(aiToggle)) return null;
  const provider = String(process.env.TELEGRAM_AI_PROVIDER || "").trim().toLowerCase() || "gemini";
  const model = String(process.env.TELEGRAM_AI_MODEL || process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it").trim();

  const prompt = [
    "You are a Telegram intent parser for trading alerts.",
    "Return JSON only. No markdown. No extra text.",
    'Schema: {"intent":"string","payload":{},"suggestion":"string?","missing_fields":["string"]}',
    "If information is missing, keep the best partial payload, set intent to the target action, include missing_fields, and write a short suggestion question in the user's language.",
    "Do not invent missing values. Respect the user's language for suggestion.",
    "Allowed intents: show_menu, help, list_alerts, delete_alert, delete_all_alerts, create_price_alert_percent, create_price_alert_absolute, create_rsi_alert, create_ma_cross_alert, create_indicator_alert, create_web_indicator_alert, show_scanner_matrix, unknown",
    pendingIntent ? `CONTEXT: ${JSON.stringify(pendingIntent)}` : "",
    `INPUT: "${text}"`,
  ].join("\n");

  let res;
  const useOpenAiCompat = provider === "openai_compat" || provider === "openai" || provider === "gemma";
  if (useOpenAiCompat) {
    const apiKey = String(process.env.TELEGRAM_AI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) return null;
    const baseUrl = String(process.env.TELEGRAM_AI_BASE_URL || "https://openrouter.ai/api/v1").trim().replace(/\/+$/, "");
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: "Extract Telegram alert intent. Output valid JSON only." }, { role: "user", content: prompt }],
      }),
    });
  } else {
    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) return null;
    const runtimeModel = await resolveGeminiRuntimeModel(apiKey, model);
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(runtimeModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
  }

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const textOut = useOpenAiCompat ? data?.choices?.[0]?.message?.content : extractGeminiTextResponse(data);
  if (!textOut) return null;
  const jsonText = extractJsonObject(textOut);
  if (!jsonText) return null;
  const parsed = JSON.parse(jsonText);
  const normalized = normalizeAiIntent(parsed);
  if (normalized.type === "unknown" && !normalized.suggestion) return null;
  return normalized;
}
