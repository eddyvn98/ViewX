import { sendTelegramMessage } from "./telegram.js";
import { parseTelegramIntent } from "./telegramIntent.js";
import { stripDiacritics } from "./telegramBot.indicators.js";
import { normalizeSymbol, formatPrice, parseWebDrivenCrossIntent, normalizeRequestedTimeframe } from "./telegramBot.helpers.js";
import { normalizeBotState, getScanners, getWatchlist, loadUserSetupState } from "./telegramBot.state.js";
import { collapseSymbolForMatch } from "./telegram-intent/shared.js";
import { sendMainMenu, buildTextCommandHelp, buildTextAlertsSummary } from "./telegramBot.ui.js";
import { renderScannerMatrixText, sendScannerMatrixSnapshot } from "./telegramBot.context.js";
import { createCrossAlertsFromWebIndicators, createCrossAlertsFromActiveWebPair } from "./telegramBot.alerts.js";
import { executeTelegramAction } from "./telegramBot.actionExecutor.js";
import { trackTelegramNluEvent } from "./telegramBot.nluLearning.js";
import { userModel } from "../model/user.js";
import { logInfo } from "../logger.js";

function t(lang, vi, en) {
  return lang === "en" ? en : vi;
}

function summarizeIntent(intent) {
  const payload = intent?.payload && typeof intent.payload === "object" ? intent.payload : {};
  return ["symbol", "timeframe", "operator", "targetPrice", "threshold", "leftType", "rightType", "fastType", "slowType", "mode"]
    .filter((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== "")
    .map((key) => `${key}=${payload[key]}`)
    .join(" ");
}

function logAlertCreated(userId, chatId, kind, details = {}) {
  logInfo("telegram.alert.created", {
    user_id: String(userId || ""),
    chat_id: String(chatId || ""),
    kind,
    ...details,
  });
}

async function savePendingIntent(userId, pendingIntent) {
  await userModel.findByIdAndUpdate(userId, { "telegram.botState.pendingIntent": pendingIntent });
}

function detectReplyLanguage(text, intent) {
  if (intent?.meta?.lang) return intent.meta.lang;
  return /(?:alert|price|help|delete|cross|indicator|timeframe|current|chart)/i.test(String(text || "")) ? "en" : "vi";
}

function getStateSymbols(state) {
  const values = new Set();
  for (const item of getWatchlist(state)) {
    const symbol = normalizeSymbol(item);
    if (symbol) values.add(symbol);
  }
  const tabs = state?.tabs && typeof state.tabs === "object" ? state.tabs : {};
  for (const tab of Object.values(tabs)) {
    if (!tab || typeof tab !== "object") continue;
    const charts = tab?.charts && typeof tab.charts === "object" ? tab.charts : {};
    for (const chart of Object.values(charts)) {
      const symbol = normalizeSymbol(chart?.symbol || "");
      if (symbol) values.add(symbol);
    }
  }
  return Array.from(values);
}

function resolveUserSymbol(state, requestedSymbol) {
  const normalizedRequested = normalizeSymbol(requestedSymbol || "");
  if (!normalizedRequested) return "";
  const requestedRaw = String(requestedSymbol || "").trim().toUpperCase();

  const stateSymbols = getStateSymbols(state);
  if (!stateSymbols.length) return normalizedRequested;

  const exact = stateSymbols.find((symbol) => symbol === normalizedRequested);
  if (exact) return exact;

  const requestedCollapsed = collapseSymbolForMatch(normalizedRequested);
  const collapsedMatches = stateSymbols.filter((symbol) => collapseSymbolForMatch(symbol) === requestedCollapsed);
  if (collapsedMatches.length === 1) return collapsedMatches[0];

  const requestedFamily = requestedCollapsed.replace(/USD$/i, "");
  const familyMatches = stateSymbols.filter((symbol) => collapseSymbolForMatch(symbol).startsWith(requestedFamily));
  if (familyMatches.length === 1) return familyMatches[0];

  const wantsMVariant = /(USDM|M)$/i.test(normalizedRequested) || /(USDM|M)$/i.test(requestedRaw);
  const prefersM = (symbol) => /(USDM|M)$/i.test(String(symbol || ""));
  if (wantsMVariant) {
    const mCollapsed = collapsedMatches.filter(prefersM);
    if (mCollapsed.length === 1) return mCollapsed[0];
    const mFamily = familyMatches.filter(prefersM);
    if (mFamily.length === 1) return mFamily[0];
  }

  const activeTabId = String(state?.activeTabId || "");
  const activeTab = state?.tabs && typeof state.tabs === "object" ? state.tabs[activeTabId] : null;
  const activeChartId = String(activeTab?.activeChartId || "");
  const activeChartSymbol = normalizeSymbol(activeTab?.charts?.[activeChartId]?.symbol || "");
  if (activeChartSymbol && collapsedMatches.includes(activeChartSymbol) && (!wantsMVariant || prefersM(activeChartSymbol))) return activeChartSymbol;
  if (activeChartSymbol && familyMatches.includes(activeChartSymbol) && (!wantsMVariant || prefersM(activeChartSymbol))) return activeChartSymbol;

  return (wantsMVariant ? familyMatches.find(prefersM) || collapsedMatches.find(prefersM) : null) || familyMatches[0] || collapsedMatches[0] || normalizedRequested;
}

export function detectActivePairCrossIntent(text) {
  const plainText = String(text || "").toLowerCase();
  const plainNoDiacritics = stripDiacritics(plainText);
  const impliesCurrentTwoLines =
    /((2|hai)\s*(duong|indicator).{0,24}(nay)|duong\s*nay|these\s+two\s+indicators|current\s+two\s+indicators)/i.test(plainNoDiacritics)
    && /(giao\s*cat|cat\s*nhau|cross|crossing)/i.test(plainNoDiacritics);
  if (!impliesCurrentTwoLines) return null;
  const tfMatch = plainNoDiacritics.match(/(?:khung|timeframe|tf)\s*(m1|m5|m15|h1|h4|1m|5m|15m|1h|4h|1|5|15|60|240)\b/i);
  return {
    requestedTimeframe: normalizeRequestedTimeframe(tfMatch?.[1] || ""),
  };
}

function isAffirmative(text) {
  return /^(?:ok|oke|okey|yes|y|co|dong y|xac nhan|confirm|tao di|lam di|trien khai)$/i.test(stripDiacritics(String(text || "").trim().toLowerCase()));
}

function isNegative(text) {
  return /^(?:khong|khong dong y|no|n|cancel|huy|thoi|dung lai)$/i.test(stripDiacritics(String(text || "").trim().toLowerCase()));
}

function looksLikeFreshRequest(text) {
  return /(?:alert|canh bao|rsi|ema|hma|indicator|chi bao|xoa|delete|scanner|matrix|menu|help|btc|eth|xau|gold|vang|>|<)/i.test(String(text || ""));
}

function buildConfirmationPrompt(intent, lang) {
  const payload = intent?.payload && typeof intent.payload === "object" ? intent.payload : {};
  if (intent?.type === "create_price_alert_percent") {
    return t(lang, `Mình hiểu là tạo alert giá cho ${payload.symbol} ${payload.timeframe}, hướng ${payload.direction === "lt" ? "giảm" : "tăng"} ${payload.percent}%.\nTrả lời "có" để tạo, hoặc "không" để hủy.`, `I understand this as a percentage price alert for ${payload.symbol} ${payload.timeframe}, ${payload.direction === "lt" ? "down" : "up"} ${payload.percent}%.\nReply "yes" to create it, or "no" to cancel.`);
  }
  if (intent?.type === "create_price_alert_absolute") {
    return t(lang, `Mình hiểu là tạo alert giá cho ${payload.symbol} ${payload.timeframe} ${payload.operator} ${payload.targetPrice}.\nTrả lời "có" để tạo, hoặc "không" để hủy.`, `I understand this as a price alert for ${payload.symbol} ${payload.timeframe} ${payload.operator} ${payload.targetPrice}.\nReply "yes" to create it, or "no" to cancel.`);
  }
  if (intent?.type === "create_rsi_alert") {
    return t(lang, `Mình hiểu là tạo RSI alert${payload.allSymbols ? " cho watchlist" : ` cho ${payload.symbol}`} ở ${payload.timeframe}: RSI(${payload.period || 14}) ${payload.condition === "lt" ? "<" : ">"} ${payload.threshold}.\nTrả lời "có" để tạo, hoặc "không" để hủy.`, `I understand this as an RSI alert${payload.allSymbols ? " for your watchlist" : ` for ${payload.symbol}`} on ${payload.timeframe}: RSI(${payload.period || 14}) ${payload.condition === "lt" ? "<" : ">"} ${payload.threshold}.\nReply "yes" to create it, or "no" to cancel.`);
  }
  if (intent?.type === "create_ma_cross_alert") {
    return t(lang, `Mình hiểu là tạo MA cross alert cho ${payload.symbol} ${payload.timeframe}: ${String(payload.fastType || "").toUpperCase()}${payload.fastPeriod} ${payload.direction === "bear" ? "cắt xuống" : "cắt lên"} ${String(payload.slowType || "").toUpperCase()}${payload.slowPeriod}.\nTrả lời "có" để tạo, hoặc "không" để hủy.`, `I understand this as an MA cross alert for ${payload.symbol} ${payload.timeframe}: ${String(payload.fastType || "").toUpperCase()}${payload.fastPeriod} ${payload.direction === "bear" ? "crossing below" : "crossing above"} ${String(payload.slowType || "").toUpperCase()}${payload.slowPeriod}.\nReply "yes" to create it, or "no" to cancel.`);
  }
  if (intent?.type === "create_indicator_alert") {
    const leftLabel = Number(payload.leftPeriod || 0) > 0 ? `${String(payload.leftType || "").toUpperCase()}${Number(payload.leftPeriod)}` : String(payload.leftType || "").toUpperCase();
    const rightLabel = Number(payload.rightPeriod || 0) > 0 ? `${String(payload.rightType || "").toUpperCase()}${Number(payload.rightPeriod)}` : String(payload.rightType || "").toUpperCase();
    return t(lang, `Mình hiểu là tạo indicator alert cho ${payload.symbol} ${payload.timeframe}: ${leftLabel} ${payload.operator} ${rightLabel}.\nTrả lời "có" để tạo, hoặc "không" để hủy.`, `I understand this as an indicator alert for ${payload.symbol} ${payload.timeframe}: ${leftLabel} ${payload.operator} ${rightLabel}.\nReply "yes" to create it, or "no" to cancel.`);
  }
  if (intent?.type === "delete_alert") {
    return t(lang, "Mình sẽ xóa alert bạn vừa chỉ ra.\nTrả lời \"có\" để xác nhận, hoặc \"không\" để hủy.", "I am about to delete the alert you referenced.\nReply \"yes\" to confirm, or \"no\" to cancel.");
  }
  if (intent?.type === "delete_all_alerts") {
    return t(lang, "Mình sẽ xóa toàn bộ alert đang bật.\nTrả lời \"có\" để xác nhận, hoặc \"không\" để hủy.", "I am about to delete all active alerts.\nReply \"yes\" to confirm, or \"no\" to cancel.");
  }
  return t(lang, "Mình đã hiểu lệnh. Trả lời \"có\" để xác nhận, hoặc \"không\" để hủy.", "I understood the request. Reply \"yes\" to confirm, or \"no\" to cancel.");
}

async function executeIntentAndReply({ user, state, botState, chatId, lang, intent }) {
  const result = await executeTelegramAction({
    userId: user._id,
    state,
    botState,
    intent,
    resolveSymbol: (symbol) => resolveUserSymbol(state, symbol),
  });

  if (intent.type === "delete_alert") {
    if (!result.alertId) {
      await sendTelegramMessage({ chatId, text: t(lang, "Không tìm thấy alert cần xóa. Dùng /alerts để lấy danh sách mới nhất.", "I could not find the alert to delete. Use /alerts to get the latest list."), parseMode: "" });
      return true;
    }
    if (!result.removed) {
      await sendTelegramMessage({ chatId, text: t(lang, "Không tìm thấy alert theo id/index đã gửi.", "I could not find an alert matching that id/index."), parseMode: "" });
      return true;
    }
    const nextState = await loadUserSetupState(user._id);
    const nextUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
    const nextBotState = normalizeBotState(nextUser?.telegram?.botState || {});
    await sendTelegramMessage({ chatId, text: t(lang, `Đã xóa alert ${result.alertId}.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`, `Deleted alert ${result.alertId}.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`), parseMode: "" });
    return true;
  }

  if (intent.type === "delete_all_alerts") {
    const nextState = await loadUserSetupState(user._id);
    const nextUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
    const nextBotState = normalizeBotState(nextUser?.telegram?.botState || {});
    await sendTelegramMessage({ chatId, text: t(lang, `Đã xóa tất cả cảnh báo đang hoạt động.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`, `Deleted all active alerts.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`), parseMode: "" });
    return true;
  }

  if (intent.type === "create_price_alert_percent") {
    logAlertCreated(user._id, chatId, "price_percent", {
      symbol: result.resolvedSymbol,
      timeframe: result.payload?.timeframe,
      direction: result.payload?.direction,
      percent: result.payload?.percent,
      target_price: result?.targetPrice ?? null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        t(lang, "Đã tạo alert giá (theo %).", "Created a percentage price alert."),
        t(lang, `Mã: ${result.resolvedSymbol} ${result.payload?.timeframe}`, `Symbol: ${result.resolvedSymbol} ${result.payload?.timeframe}`),
        t(lang, `Giá hiện tại: ${formatPrice(result.currentPrice)}`, `Current price: ${formatPrice(result.currentPrice)}`),
        t(lang, `Mức cảnh báo: ${formatPrice(result.targetPrice)}`, `Alert level: ${formatPrice(result.targetPrice)}`),
      ].join("\n"),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_price_alert_absolute") {
    logAlertCreated(user._id, chatId, "price_absolute", {
      symbol: result.resolvedSymbol,
      timeframe: result.payload?.timeframe,
      operator: result.payload?.operator,
      target_price: result?.targetPrice ?? null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        t(lang, "Đã tạo alert giá (mức cụ thể).", "Created an absolute price alert."),
        t(lang, `Mã: ${result.resolvedSymbol} ${result.payload?.timeframe}`, `Symbol: ${result.resolvedSymbol} ${result.payload?.timeframe}`),
        t(lang, `Điều kiện: ${result.payload?.operator} ${formatPrice(result.targetPrice)}`, `Condition: ${result.payload?.operator} ${formatPrice(result.targetPrice)}`),
        result.currentPrice
          ? t(lang, `Giá hiện tại: ${formatPrice(result.currentPrice)}`, `Current price: ${formatPrice(result.currentPrice)}`)
          : t(lang, "Giá hiện tại: không lấy được", "Current price: unavailable"),
      ].join("\n"),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_rsi_alert") {
    if (result.createdCount) {
      logAlertCreated(user._id, chatId, "rsi_watchlist", {
        timeframe: result.resolvedTimeframe,
        threshold: result.threshold,
        period: result.period,
        condition: result.condition,
        created_count: result.createdCount,
      });
      await sendTelegramMessage({
        chatId,
        text: t(lang, `Đã tạo RSI alert cho ${result.createdCount} symbol trong watchlist (${result.resolvedTimeframe}): RSI(${result.period}) ${result.condition === "lt" ? "<" : ">"} ${result.threshold}`, `Created RSI alerts for ${result.createdCount} symbols in your watchlist (${result.resolvedTimeframe}): RSI(${result.period}) ${result.condition === "lt" ? "<" : ">"} ${result.threshold}`),
        parseMode: "",
      });
      return true;
    }
    logAlertCreated(user._id, chatId, "rsi", {
      symbol: result.resolvedSymbol,
      timeframe: result.resolvedTimeframe,
      threshold: result.threshold,
      period: result.period,
      condition: result.condition,
    });
    await sendTelegramMessage({
      chatId,
      text: t(lang, `Đã tạo RSI alert: ${result.resolvedSymbol} ${result.resolvedTimeframe} RSI(${result.period}) ${result.condition === "lt" ? "<" : ">"} ${result.threshold}`, `Created RSI alert: ${result.resolvedSymbol} ${result.resolvedTimeframe} RSI(${result.period}) ${result.condition === "lt" ? "<" : ">"} ${result.threshold}`),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_ma_cross_alert") {
    logAlertCreated(user._id, chatId, "ma_cross", {
      symbol: result.resolvedSymbol,
      timeframe: result.timeframe,
      fast_type: result.fastType,
      fast_period: result.fastPeriod,
      slow_type: result.slowType,
      slow_period: result.slowPeriod,
      direction: result.direction,
    });
    await sendTelegramMessage({
      chatId,
      text: t(lang, `Đã tạo MA cross alert: ${result.resolvedSymbol} ${result.timeframe} ${result.fastType}${result.fastPeriod} ${result.direction === "bear" ? "cắt xuống" : "cắt lên"} ${result.slowType}${result.slowPeriod}`, `Created MA cross alert: ${result.resolvedSymbol} ${result.timeframe} ${result.fastType}${result.fastPeriod} ${result.direction === "bear" ? "crossing below" : "crossing above"} ${result.slowType}${result.slowPeriod}`),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_indicator_alert") {
    logAlertCreated(user._id, chatId, "indicator_rule", {
      symbol: result.resolvedSymbol,
      timeframe: result.timeframe,
      left_type: result.leftType,
      left_period: result.leftPeriod,
      operator: result.operator,
      right_type: result.rightType,
      right_period: result.rightPeriod,
    });
    const leftLabel = result.leftPeriod > 0 ? `${result.leftType}${result.leftPeriod}` : result.leftType;
    const rightLabel = result.rightPeriod > 0 ? `${result.rightType}${result.rightPeriod}` : result.rightType;
    await sendTelegramMessage({ chatId, text: t(lang, `Đã tạo indicator alert: ${result.resolvedSymbol} ${result.timeframe} ${leftLabel} ${result.operator} ${rightLabel}`, `Created indicator alert: ${result.resolvedSymbol} ${result.timeframe} ${leftLabel} ${result.operator} ${rightLabel}`), parseMode: "" });
    return true;
  }

  return false;
}

export async function handleTextIntent({ user, state, chatId, text }) {
  const activePairCross = detectActivePairCrossIntent(text);
  if (activePairCross) {
    const lang = /(?:these|current|cross|indicator|chart)/i.test(String(text || "")) ? "en" : "vi";
    try {
      const result = await createCrossAlertsFromActiveWebPair(user._id, state, activePairCross.requestedTimeframe, "");
      await sendTelegramMessage({
        chatId,
        text: [
          t(lang, "Đã tạo cảnh báo giao cắt theo 2 indicator đang bật trên chart web của bạn.", "I created crossover alerts from the two indicators currently enabled on your web chart."),
          t(lang, `Mã/Khung: ${result.symbol} ${result.timeframe}`, `Symbol/Timeframe: ${result.symbol} ${result.timeframe}`),
          t(lang, `Tổng alert đã tạo: ${result.createdCount} (cắt lên + cắt xuống).`, `Created ${result.createdCount} alerts (cross up + cross down).`),
        ].join("\n"),
        parseMode: "",
      });
      return true;
    } catch (error) {
      await sendTelegramMessage({
        chatId,
        text: t(lang, `Không tạo được alert theo 2 đường hiện tại: ${String(error?.message || "unknown_error")}`, `Could not create alerts from the current two indicators: ${String(error?.message || "unknown_error")}`),
        parseMode: "",
      });
      return true;
    }
  }

  const botState = normalizeBotState(user.telegram?.botState);
  const pendingIntent = botState.pendingIntent && typeof botState.pendingIntent === "object" ? botState.pendingIntent : null;
  if (pendingIntent?.stage === "confirm_action" && pendingIntent.actionIntent) {
    const lang = String(pendingIntent._lang || detectReplyLanguage(text, null) || "vi");
    if (isAffirmative(text)) {
      await savePendingIntent(user._id, null);
      try {
        return await executeIntentAndReply({ user, state, botState, chatId, lang, intent: pendingIntent.actionIntent });
      } catch (error) {
        const code = String(error?.message || "unknown_error");
        const message = code === "duplicate_ma_pair"
          ? t(lang, "Không tạo được: MA nhanh và MA chậm đang trùng nhau.", "Could not create the alert because the fast and slow moving averages are identical.")
          : code === "duplicate_indicator_pair"
            ? t(lang, "Không tạo được: hai vế chỉ báo đang giống nhau.", "Could not create the alert because both indicator sides are identical.")
            : code === "missing_target_price"
              ? t(lang, "Bạn cần cung cấp mức giá cảnh báo cụ thể trước khi tạo.", "Please provide a concrete target price before creating this alert.")
            : code === "unsupported_indicator_pair"
              ? t(lang, "Bot chưa hỗ trợ cặp chỉ báo này cho cảnh báo hiện tại.", "The bot does not support this indicator pair for the current alert.")
              : t(lang, `Không xử lý được lệnh: ${code}`, `Could not process the request: ${code}`);
        await sendTelegramMessage({ chatId, text: message, parseMode: "" });
        return true;
      }
    }
    if (isNegative(text)) {
      await savePendingIntent(user._id, null);
      await sendTelegramMessage({ chatId, text: t(lang, "Đã hủy thao tác trước đó. Bạn cứ nhắn yêu cầu mới tự nhiên nhé.", "Cancelled the previous action. Feel free to send a new request naturally."), parseMode: "" });
      return true;
    }
    if (!looksLikeFreshRequest(text)) {
      await sendTelegramMessage({ chatId, text: t(lang, "Mình đang chờ bạn xác nhận. Trả lời \"có\" để tiếp tục hoặc \"không\" để hủy.", "I am waiting for your confirmation. Reply \"yes\" to continue or \"no\" to cancel."), parseMode: "" });
      return true;
    }
    await savePendingIntent(user._id, null);
  }

  const intent = await parseTelegramIntent(text, botState.pendingIntent, String(user._id || ""));
  const lang = detectReplyLanguage(text, intent);

  logInfo("telegram.intent.resolved", {
    user_id: String(user._id || ""),
    chat_id: String(chatId || ""),
    source: intent?.meta?.source || "unknown",
    type: intent?.type || "unknown",
    lang,
    has_pending: Boolean(botState.pendingIntent),
    summary: summarizeIntent(intent),
  });

  trackTelegramNluEvent({
    ownerUserId: String(user._id || ""),
    chatId: String(chatId || ""),
    text,
    intent: {
      ...intent,
      summary: summarizeIntent(intent),
    },
    lang,
    hasPending: Boolean(botState.pendingIntent),
  }).catch(() => null);

  if (intent.type === "unknown") {
    if (intent.suggestion) {
      await sendTelegramMessage({ chatId, text: intent.suggestion, parseMode: "" });
      const nextPendingIntent = intent.payload && Object.keys(intent.payload).length > 0 ? intent.payload : botState.pendingIntent;
      await savePendingIntent(user._id, nextPendingIntent || null);
      return true;
    }
    return false;
  }

  if (botState.pendingIntent) {
    await savePendingIntent(user._id, null);
  }

  if (intent.type === "show_menu") {
    await sendMainMenu({ user, state, chatId, messageId: null });
    return true;
  }

  if (intent.type === "help") {
    await sendTelegramMessage({
      chatId,
      text: lang === "en"
        ? "You can type natural requests like:\n- alert btc 1h > 73000\n- rsi btc 1h > 70\n- ema20 cross up ema50 on btc 15m\n- alert when these two indicators cross\n- show alerts\n- delete alert #2"
        : buildTextCommandHelp(),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "list_alerts") {
    await sendTelegramMessage({ chatId, text: buildTextAlertsSummary(state, botState), parseMode: "" });
    return true;
  }

  if (intent.type === "show_scanner_matrix") {
    const scanners = getScanners(state);
    if (!scanners || scanners.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: t(lang, "Bạn chưa có Scanner/Matrix nào được lưu trên web. Hãy tạo scanner trên trình duyệt trước khi dùng lệnh này.", "You do not have any saved Scanner/Matrix on the web yet. Please create one in the browser first."),
        parseMode: "",
      });
      return true;
    }
    const index = Math.max(0, Math.min(Number(intent.payload?.index || 0), scanners.length - 1));
    const scanner = scanners[index];
    const snap = await sendScannerMatrixSnapshot(chatId, scanner, state, `Snapshot AI: ${scanner.name || scanner.id}`);
    if (!snap?.ok) {
      await sendTelegramMessage({ chatId, text: renderScannerMatrixText(scanner, state), parseMode: "" });
    }
    return true;
  }

  if (intent.type === "delete_alert" || intent.type === "delete_all_alerts") {
    await savePendingIntent(user._id, { stage: "confirm_action", actionIntent: intent, _lang: lang });
    await sendTelegramMessage({ chatId, text: buildConfirmationPrompt(intent, lang), parseMode: "" });
    return true;
  }

  if (intent.type === "create_price_alert_percent") {
    await savePendingIntent(user._id, { stage: "confirm_action", actionIntent: intent, _lang: lang });
    await sendTelegramMessage({ chatId, text: buildConfirmationPrompt(intent, lang), parseMode: "" });
    return true;
  }

  if (intent.type === "create_price_alert_absolute") {
    const { symbol, timeframe, operator, targetPrice } = intent.payload || {};
    if (!symbol) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn đặt cảnh báo cho mã nào?", "Which symbol should I create the alert for?"), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_price_alert_absolute" });
      return true;
    }
    if (!timeframe) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn dùng khung thời gian nào? Ví dụ: 5m, 15m, 1h hoặc 4h.", "Which timeframe should I use? For example: 5m, 15m, 1h, or 4h."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_price_alert_absolute" });
      return true;
    }
    if (!Number.isFinite(Number(targetPrice)) || Number(targetPrice) <= 0) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn cảnh báo ở mức giá bao nhiêu?", "What target price should I use?"), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_price_alert_absolute" });
      return true;
    }
    if (!String(operator || "").trim()) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn điều kiện lớn hơn hay nhỏ hơn mức giá đó? Ví dụ: > 2450 hoặc < 2400.", "Should I alert when price is above or below that level? Example: > 2450 or < 2400."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_price_alert_absolute" });
      return true;
    }
    await savePendingIntent(user._id, { stage: "confirm_action", actionIntent: intent, _lang: lang });
    await sendTelegramMessage({ chatId, text: buildConfirmationPrompt(intent, lang), parseMode: "" });
    return true;
  }

  if (intent.type === "create_rsi_alert") {
    const { symbol, timeframe, threshold } = intent.payload || {};
    if (!Number.isFinite(Number(threshold))) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn cần cho mình biết ngưỡng RSI cụ thể.", "Please tell me the RSI threshold."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_rsi_alert" });
      return true;
    }
    if (!timeframe) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn dùng RSI ở khung nào? Ví dụ: 5m, 15m, 1h.", "Which timeframe should I use for RSI? For example: 5m, 15m, or 1h."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_rsi_alert" });
      return true;
    }
    if (!intent.payload?.allSymbols && !symbol) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn tạo RSI alert cho mã nào?", "Which symbol should I use for the RSI alert?"), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_rsi_alert" });
      return true;
    }
    await savePendingIntent(user._id, { stage: "confirm_action", actionIntent: intent, _lang: lang });
    await sendTelegramMessage({ chatId, text: buildConfirmationPrompt(intent, lang), parseMode: "" });
    return true;
  }

  if (intent.type === "create_ma_cross_alert") {
    const { symbol, timeframe, fastType, slowType, fastPeriod, slowPeriod } = intent.payload || {};
    if (!symbol || !timeframe || !fastType || !slowType || !fastPeriod || !slowPeriod) {
      await sendTelegramMessage({ chatId, text: t(lang, "Mình còn thiếu dữ liệu cho MA cross. Ví dụ đầy đủ: EMA20 cắt lên EMA50 trên BTC khung 1h.", "I still need more data for the MA cross alert. Example: EMA20 crossing above EMA50 on BTC 1h."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_ma_cross_alert" });
      return true;
    }
    await savePendingIntent(user._id, { stage: "confirm_action", actionIntent: intent, _lang: lang });
    await sendTelegramMessage({ chatId, text: buildConfirmationPrompt(intent, lang), parseMode: "" });
    return true;
  }

  if (intent.type === "create_indicator_alert") {
    const { symbol, timeframe, leftType, rightType } = intent.payload || {};
    if (!symbol || !timeframe || !leftType || !rightType) {
      await sendTelegramMessage({ chatId, text: t(lang, "Mình còn thiếu dữ liệu cho indicator alert. Ví dụ: EMA20 > EMA50 trên BTC khung 15m.", "I still need more data for the indicator alert. Example: EMA20 > EMA50 on BTC 15m."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_indicator_alert" });
      return true;
    }
    await savePendingIntent(user._id, { stage: "confirm_action", actionIntent: intent, _lang: lang });
    await sendTelegramMessage({ chatId, text: buildConfirmationPrompt(intent, lang), parseMode: "" });
    return true;
  }

  if (intent.type === "create_web_indicator_alert") {
    return executeIntentAndReply({ user, state, botState, chatId, lang, intent });
  }

  const webCrossIntent = parseWebDrivenCrossIntent(text);
  if (webCrossIntent) {
    const result = await createCrossAlertsFromWebIndicators(user._id, state, webCrossIntent.leftType, webCrossIntent.rightType, webCrossIntent.requestedTimeframe, webCrossIntent.requestedSymbol);
    logAlertCreated(user._id, chatId, "web_indicator_explicit", {
      symbol: result?.symbol || webCrossIntent.requestedSymbol || "",
      timeframe: result?.timeframe || webCrossIntent.requestedTimeframe || "",
      left_type: webCrossIntent.leftType,
      right_type: webCrossIntent.rightType,
      created_count: result?.createdCount ?? null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        t(lang, "Đã tạo cảnh báo giao cắt theo cấu hình chỉ báo đang bật trên web.", "Created crossover alerts from the indicator configuration currently enabled on the web chart."),
        t(lang, `Cặp chỉ báo: ${webCrossIntent.leftType} và ${webCrossIntent.rightType}`, `Indicator pair: ${webCrossIntent.leftType} and ${webCrossIntent.rightType}`),
        t(lang, `Mã/Khung: ${result.symbol} ${result.timeframe}`, `Symbol/Timeframe: ${result.symbol} ${result.timeframe}`),
        t(lang, `Chu kỳ ${webCrossIntent.leftType}: ${result.leftPeriods.join(", ")}`, `${webCrossIntent.leftType} periods: ${result.leftPeriods.join(", ")}`),
        t(lang, `Chu kỳ ${webCrossIntent.rightType}: ${result.rightPeriods.join(", ")}`, `${webCrossIntent.rightType} periods: ${result.rightPeriods.join(", ")}`),
        t(lang, `Tổng alert đã tạo: ${result.createdCount} (bao gồm cả cắt lên và cắt xuống).`, `Created ${result.createdCount} alerts (including cross up and cross down).`),
      ].join("\n"),
      parseMode: "",
    });
    return true;
  }

  return false;
}
