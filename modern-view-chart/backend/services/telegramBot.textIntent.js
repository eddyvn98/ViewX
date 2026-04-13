import { sendTelegramMessage } from "./telegram.js";
import { parseTelegramIntent } from "./telegramIntent.js";
import { normalizeMaType, isIndicatorSupported, stripDiacritics } from "./telegramBot.indicators.js";
import { normalizeSymbol, normalizeTimeframe, formatPrice, parseWebDrivenCrossIntent, normalizeRequestedTimeframe } from "./telegramBot.helpers.js";
import { normalizeBotState, getScanners, getWatchlist, loadUserSetupState } from "./telegramBot.state.js";
import { collapseSymbolForMatch } from "./telegram-intent/shared.js";
import { sendMainMenu, buildTextCommandHelp, buildTextAlertsSummary } from "./telegramBot.ui.js";
import { renderScannerMatrixText, sendScannerMatrixSnapshot } from "./telegramBot.context.js";
import {
  createPriceAlert,
  createAbsolutePriceAlert,
  createIndicatorAlert,
  deleteManagedAlert,
  deleteAllManagedAlerts,
  resolveAlertIdFromDeleteIntent,
  createCrossAlertsFromWebIndicators,
  createCrossAlertsFromActiveWebPair,
} from "./telegramBot.alerts.js";
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

  if (intent.type === "delete_alert") {
    const alertId = resolveAlertIdFromDeleteIntent(intent.payload, state, botState);
    if (!alertId) {
      await sendTelegramMessage({ chatId, text: t(lang, "Không tìm thấy alert cần xóa. Dùng /alerts để lấy danh sách mới nhất.", "I could not find the alert to delete. Use /alerts to get the latest list."), parseMode: "" });
      return true;
    }
    const removed = await deleteManagedAlert(user._id, alertId);
    if (!removed) {
      await sendTelegramMessage({ chatId, text: t(lang, "Không tìm thấy alert theo id/index đã gửi.", "I could not find an alert matching that id/index."), parseMode: "" });
      return true;
    }
    const nextState = await loadUserSetupState(user._id);
    const nextUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
    const nextBotState = normalizeBotState(nextUser?.telegram?.botState || {});
    await sendTelegramMessage({ chatId, text: t(lang, `Đã xóa alert ${alertId}.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`, `Deleted alert ${alertId}.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`), parseMode: "" });
    return true;
  }

  if (intent.type === "delete_all_alerts") {
    await deleteAllManagedAlerts(user._id);
    const nextState = await loadUserSetupState(user._id);
    const nextUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
    const nextBotState = normalizeBotState(nextUser?.telegram?.botState || {});
    await sendTelegramMessage({ chatId, text: t(lang, `Đã xóa tất cả cảnh báo đang hoạt động.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`, `Deleted all active alerts.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`), parseMode: "" });
    return true;
  }

  if (intent.type === "create_price_alert_percent") {
    const { symbol, timeframe, direction, percent } = intent.payload || {};
    const resolvedSymbol = resolveUserSymbol(state, symbol);
    const created = await createPriceAlert(user._id, resolvedSymbol, timeframe, direction, percent);
    logAlertCreated(user._id, chatId, "price_percent", {
      symbol: resolvedSymbol,
      timeframe,
      direction,
      percent,
      target_price: created?.targetPrice ?? null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        t(lang, "Đã tạo alert giá (theo %).", "Created a percentage price alert."),
        t(lang, `Mã: ${resolvedSymbol} ${timeframe}`, `Symbol: ${resolvedSymbol} ${timeframe}`),
        t(lang, `Giá hiện tại: ${formatPrice(created.currentPrice)}`, `Current price: ${formatPrice(created.currentPrice)}`),
        t(lang, `Mức cảnh báo: ${formatPrice(created.targetPrice)}`, `Alert level: ${formatPrice(created.targetPrice)}`),
      ].join("\n"),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_price_alert_absolute") {
    const { symbol, timeframe, operator, targetPrice } = intent.payload || {};
    const resolvedSymbol = resolveUserSymbol(state, symbol);
    const created = await createAbsolutePriceAlert(user._id, resolvedSymbol, timeframe, operator, targetPrice);
    logAlertCreated(user._id, chatId, "price_absolute", {
      symbol: resolvedSymbol,
      timeframe,
      operator,
      target_price: created?.targetPrice ?? null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        t(lang, "Đã tạo alert giá (mức cụ thể).", "Created an absolute price alert."),
        t(lang, `Mã: ${resolvedSymbol} ${timeframe}`, `Symbol: ${resolvedSymbol} ${timeframe}`),
        t(lang, `Điều kiện: ${operator} ${formatPrice(created.targetPrice)}`, `Condition: ${operator} ${formatPrice(created.targetPrice)}`),
        created.currentPrice
          ? t(lang, `Giá hiện tại: ${formatPrice(created.currentPrice)}`, `Current price: ${formatPrice(created.currentPrice)}`)
          : t(lang, "Giá hiện tại: không lấy được", "Current price: unavailable"),
      ].join("\n"),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_rsi_alert") {
    const { symbol, timeframe, period, condition, threshold, allSymbols } = intent.payload || {};
    const periodValue = Math.max(2, Number(period || 14));
    const thresholdValue = Number(threshold);
    const conditionValue = condition === "lt" ? "lt" : "gt";

    if (!Number.isFinite(thresholdValue)) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn cần cho mình biết ngưỡng RSI cụ thể.", "Please tell me the RSI threshold."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_rsi_alert" });
      return true;
    }
    if (!timeframe) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn dùng RSI ở khung nào? Ví dụ: 5m, 15m, 1h.", "Which timeframe should I use for RSI? For example: 5m, 15m, or 1h."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_rsi_alert" });
      return true;
    }

    const resolvedTimeframe = normalizeTimeframe(timeframe);
    const watchlist = getWatchlist(state);

    if (allSymbols) {
      let created = 0;
      for (const item of watchlist) {
        await createIndicatorAlert(user._id, {
          type: "rsi",
          symbol: normalizeSymbol(item),
          timeframe: resolvedTimeframe,
          condition: conditionValue,
          threshold: thresholdValue,
          period: periodValue,
        });
        created += 1;
      }
      logAlertCreated(user._id, chatId, "rsi_watchlist", {
        timeframe: resolvedTimeframe,
        threshold: thresholdValue,
        period: periodValue,
        condition: conditionValue,
        created_count: created,
      });
      await sendTelegramMessage({
        chatId,
        text: t(lang, `Đã tạo RSI alert cho ${created} symbol trong watchlist (${resolvedTimeframe}): RSI(${periodValue}) ${conditionValue === "lt" ? "<" : ">"} ${thresholdValue}`, `Created RSI alerts for ${created} symbols in your watchlist (${resolvedTimeframe}): RSI(${periodValue}) ${conditionValue === "lt" ? "<" : ">"} ${thresholdValue}`),
        parseMode: "",
      });
      return true;
    }

    if (!symbol) {
      await sendTelegramMessage({ chatId, text: t(lang, "Bạn muốn tạo RSI alert cho mã nào?", "Which symbol should I use for the RSI alert?"), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_rsi_alert" });
      return true;
    }

    const resolvedSymbol = resolveUserSymbol(state, symbol);
    await createIndicatorAlert(user._id, {
      type: "rsi",
      symbol: resolvedSymbol,
      timeframe: resolvedTimeframe,
      condition: conditionValue,
      threshold: thresholdValue,
      period: periodValue,
    });
    logAlertCreated(user._id, chatId, "rsi", {
      symbol: resolvedSymbol,
      timeframe: resolvedTimeframe,
      threshold: thresholdValue,
      period: periodValue,
      condition: conditionValue,
    });
    await sendTelegramMessage({
      chatId,
      text: t(lang, `Đã tạo RSI alert: ${resolvedSymbol} ${resolvedTimeframe} RSI(${periodValue}) ${conditionValue === "lt" ? "<" : ">"} ${thresholdValue}`, `Created RSI alert: ${resolvedSymbol} ${resolvedTimeframe} RSI(${periodValue}) ${conditionValue === "lt" ? "<" : ">"} ${thresholdValue}`),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_ma_cross_alert") {
    const { symbol, timeframe, fastType, fastPeriod, slowType, slowPeriod, direction } = intent.payload || {};
    if (!symbol || !timeframe || !fastType || !slowType || !fastPeriod || !slowPeriod) {
      await sendTelegramMessage({ chatId, text: t(lang, "Mình còn thiếu dữ liệu cho MA cross. Ví dụ đầy đủ: EMA20 cắt lên EMA50 trên BTC khung 1h.", "I still need more data for the MA cross alert. Example: EMA20 crossing above EMA50 on BTC 1h."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_ma_cross_alert" });
      return true;
    }
    if (String(fastType).toUpperCase() === String(slowType).toUpperCase() && Number(fastPeriod) === Number(slowPeriod)) {
      await sendTelegramMessage({ chatId, text: t(lang, "Không tạo được: MA nhanh và MA chậm đang trùng nhau.", "Could not create the alert because the fast and slow moving averages are identical."), parseMode: "" });
      return true;
    }
    const resolvedSymbol = resolveUserSymbol(state, symbol);
    await createIndicatorAlert(user._id, {
      type: "ma_cross",
      symbol: resolvedSymbol,
      timeframe: normalizeTimeframe(timeframe),
      fastType: normalizeMaType(fastType),
      fastPeriod: Math.max(2, Number(fastPeriod || 9)),
      slowType: normalizeMaType(slowType),
      slowPeriod: Math.max(2, Number(slowPeriod || 20)),
      direction: direction === "bear" ? "bear" : "bull",
    });
    logAlertCreated(user._id, chatId, "ma_cross", {
      symbol: resolvedSymbol,
      timeframe,
      fast_type: fastType,
      fast_period: fastPeriod,
      slow_type: slowType,
      slow_period: slowPeriod,
      direction,
    });
    await sendTelegramMessage({
      chatId,
      text: t(lang, `Đã tạo MA cross alert: ${resolvedSymbol} ${timeframe} ${String(fastType).toUpperCase()}${fastPeriod} ${direction === "bear" ? "cắt xuống" : "cắt lên"} ${String(slowType).toUpperCase()}${slowPeriod}`, `Created MA cross alert: ${resolvedSymbol} ${timeframe} ${String(fastType).toUpperCase()}${fastPeriod} ${direction === "bear" ? "crossing below" : "crossing above"} ${String(slowType).toUpperCase()}${slowPeriod}`),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_indicator_alert") {
    const { symbol, timeframe, leftType, leftPeriod, operator, rightType, rightPeriod } = intent.payload || {};
    if (!symbol || !timeframe || !leftType || !rightType) {
      await sendTelegramMessage({ chatId, text: t(lang, "Mình còn thiếu dữ liệu cho indicator alert. Ví dụ: EMA20 > EMA50 trên BTC khung 15m.", "I still need more data for the indicator alert. Example: EMA20 > EMA50 on BTC 15m."), parseMode: "" });
      await savePendingIntent(user._id, { ...(intent.payload || {}), intent: "create_indicator_alert" });
      return true;
    }
    if (!isIndicatorSupported(leftType) || !isIndicatorSupported(rightType)) {
      await sendTelegramMessage({ chatId, text: t(lang, `Hiện bot chưa hỗ trợ chỉ báo ${leftType}/${rightType} cho cảnh báo này.`, `The bot does not support ${leftType}/${rightType} for this alert yet.`), parseMode: "" });
      return true;
    }
    if (String(leftType).toUpperCase() === String(rightType).toUpperCase() && Number(leftPeriod || 0) === Number(rightPeriod || 0)) {
      await sendTelegramMessage({ chatId, text: t(lang, "Không tạo được: hai vế chỉ báo đang giống nhau.", "Could not create the alert because both indicator sides are identical."), parseMode: "" });
      return true;
    }
    const resolvedSymbol = resolveUserSymbol(state, symbol);
    await createIndicatorAlert(user._id, {
      type: "indicator_rule",
      symbol: resolvedSymbol,
      timeframe: normalizeTimeframe(timeframe),
      leftType: String(leftType).toUpperCase(),
      leftPeriod: Math.max(0, Number(leftPeriod || 0)),
      operator: operator || ">",
      rightType: String(rightType).toUpperCase(),
      rightPeriod: Math.max(0, Number(rightPeriod || 0)),
    });
    logAlertCreated(user._id, chatId, "indicator_rule", {
      symbol: resolvedSymbol,
      timeframe,
      left_type: leftType,
      left_period: leftPeriod,
      operator,
      right_type: rightType,
      right_period: rightPeriod,
    });
    const leftLabel = Number(leftPeriod || 0) > 0 ? `${String(leftType).toUpperCase()}${Number(leftPeriod)}` : String(leftType).toUpperCase();
    const rightLabel = Number(rightPeriod || 0) > 0 ? `${String(rightType).toUpperCase()}${Number(rightPeriod)}` : String(rightType).toUpperCase();
    await sendTelegramMessage({ chatId, text: t(lang, `Đã tạo indicator alert: ${resolvedSymbol} ${timeframe} ${leftLabel} ${operator} ${rightLabel}`, `Created indicator alert: ${resolvedSymbol} ${timeframe} ${leftLabel} ${operator} ${rightLabel}`), parseMode: "" });
    return true;
  }

  if (intent.type === "create_web_indicator_alert") {
    const mode = String(intent.payload?.mode || "active_pair");
    const requestedTimeframe = intent.payload?.timeframe || "";
    const requestedSymbol = intent.payload?.symbol || "";
    const result = mode === "web_pair"
      ? await createCrossAlertsFromActiveWebPair(user._id, state, requestedTimeframe, requestedSymbol)
      : await createCrossAlertsFromActiveWebPair(user._id, state, requestedTimeframe, requestedSymbol);
    logAlertCreated(user._id, chatId, "web_indicator", {
      mode,
      symbol: result?.symbol || requestedSymbol || "",
      timeframe: result?.timeframe || requestedTimeframe || "",
      created_count: result?.createdCount ?? null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        t(lang, "Đã tạo cảnh báo theo indicator đang bật trên web.", "Created alerts from the indicators currently active on the web chart."),
        t(lang, `Mã/Khung: ${result.symbol} ${result.timeframe}`, `Symbol/Timeframe: ${result.symbol} ${result.timeframe}`),
        t(lang, `Tổng alert đã tạo: ${result.createdCount}`, `Created alerts: ${result.createdCount}`),
      ].join("\n"),
      parseMode: "",
    });
    return true;
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
