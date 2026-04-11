import { sendTelegramMessage } from "./telegram.js";
import { parseTelegramIntent } from "./telegramIntent.js";
import { normalizeMaType, isIndicatorSupported } from "./telegramBot.indicators.js";
import { normalizeSymbol, normalizeTimeframe, formatPrice, parseWebDrivenCrossIntent } from "./telegramBot.helpers.js";
import { normalizeBotState } from "./telegramBot.state.js";
import { sendMainMenu, buildTextCommandHelp, buildTextAlertsSummary } from "./telegramBot.ui.js";
import {
  createPriceAlert,
  createAbsolutePriceAlert,
  createIndicatorAlert,
  deleteManagedAlert,
  resolveAlertIdFromDeleteIntent,
  createCrossAlertsFromWebIndicators,
} from "./telegramBot.alerts.js";
import { loadUserSetupState } from "./telegramBot.state.js";
import { userModel } from "../model/user.js";

export async function handleTextIntent({ user, state, chatId, text }) {
  const intent = await parseTelegramIntent(text);
  const botState = normalizeBotState(user.telegram?.botState);

  if (intent.type === "unknown") return false;

  if (intent.type === "show_menu") {
    await sendMainMenu({ user, state, chatId, messageId: null });
    return true;
  }

  if (intent.type === "help") {
    await sendTelegramMessage({ chatId, text: buildTextCommandHelp(), parseMode: "" });
    return true;
  }

  if (intent.type === "list_alerts") {
    await sendTelegramMessage({ chatId, text: buildTextAlertsSummary(state, botState), parseMode: "" });
    return true;
  }

  if (intent.type === "delete_alert") {
    const alertId = resolveAlertIdFromDeleteIntent(intent.payload, state, botState);
    if (!alertId) {
      await sendTelegramMessage({ chatId, text: "Không tìm thấy alert cần xóa. Dùng /alerts để lấy danh sách mới nhất.", parseMode: "" });
      return true;
    }
    const removed = await deleteManagedAlert(user._id, alertId);
    if (!removed) {
      await sendTelegramMessage({ chatId, text: "Không tìm thấy alert theo id/index đã gửi.", parseMode: "" });
      return true;
    }
    const nextState = await loadUserSetupState(user._id);
    const nextUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
    const nextBotState = normalizeBotState(nextUser?.telegram?.botState || {});
    await sendTelegramMessage({ chatId, text: `Da xoa alert ${alertId}.\n\n${buildTextAlertsSummary(nextState.state, nextBotState)}`, parseMode: "" });
    return true;
  }

  if (intent.type === "create_price_alert_percent") {
    const { symbol, timeframe, direction, percent } = intent.payload || {};
    const created = await createPriceAlert(user._id, symbol, timeframe, direction, percent);
    await sendTelegramMessage({
      chatId,
      text: ["Đã tạo alert giá (theo %).", `Mã: ${symbol} ${timeframe}`, `Giá hiện tại: ${formatPrice(created.currentPrice)}`, `Mức cảnh báo: ${formatPrice(created.targetPrice)}`].join("\n"),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_price_alert_absolute") {
    const { symbol, timeframe, operator, targetPrice } = intent.payload || {};
    const created = await createAbsolutePriceAlert(user._id, symbol, timeframe, operator, targetPrice);
    await sendTelegramMessage({
      chatId,
      text: ["Đã tạo alert giá (mức cụ thể).", `Mã: ${symbol} ${timeframe}`, `Điều kiện: ${operator} ${formatPrice(created.targetPrice)}`, created.currentPrice ? `Giá hiện tại: ${formatPrice(created.currentPrice)}` : "Giá hiện tại: không lấy được"].join("\n"),
      parseMode: "",
    });
    return true;
  }

  if (intent.type === "create_rsi_alert") {
    const { symbol, timeframe, period, condition, threshold } = intent.payload || {};
    await createIndicatorAlert(user._id, { type: "rsi", symbol: normalizeSymbol(symbol), timeframe: normalizeTimeframe(timeframe), condition: condition === "lt" ? "lt" : "gt", threshold: Number(threshold), period: Math.max(2, Number(period || 14)) });
    await sendTelegramMessage({ chatId, text: `Đã tạo RSI alert: ${symbol} ${timeframe} RSI(${period}) ${condition === "lt" ? "<" : ">"} ${threshold}`, parseMode: "" });
    return true;
  }

  if (intent.type === "create_ma_cross_alert") {
    const { symbol, timeframe, fastType, fastPeriod, slowType, slowPeriod, direction } = intent.payload || {};
    if (String(fastType).toUpperCase() === String(slowType).toUpperCase() && Number(fastPeriod) === Number(slowPeriod)) {
      await sendTelegramMessage({ chatId, text: "Không tạo được: MA nhanh và MA chậm đang trùng nhau.", parseMode: "" });
      return true;
    }
    await createIndicatorAlert(user._id, { type: "ma_cross", symbol: normalizeSymbol(symbol), timeframe: normalizeTimeframe(timeframe), fastType: normalizeMaType(fastType), fastPeriod: Math.max(2, Number(fastPeriod || 9)), slowType: normalizeMaType(slowType), slowPeriod: Math.max(2, Number(slowPeriod || 20)), direction: direction === "bear" ? "bear" : "bull" });
    await sendTelegramMessage({ chatId, text: `Đã tạo MA cross alert: ${symbol} ${timeframe} ${String(fastType).toUpperCase()}${fastPeriod} ${direction === "bear" ? "cắt xuống" : "cắt lên"} ${String(slowType).toUpperCase()}${slowPeriod}`, parseMode: "" });
    return true;
  }

  if (intent.type === "create_indicator_alert") {
    const { symbol, timeframe, leftType, leftPeriod, operator, rightType, rightPeriod } = intent.payload || {};
    if (!isIndicatorSupported(leftType) || !isIndicatorSupported(rightType)) {
      await sendTelegramMessage({ chatId, text: `Hiện bot chưa hỗ trợ chỉ báo ${leftType}/${rightType} cho cảnh báo giao cắt.`, parseMode: "" });
      return true;
    }
    if (String(leftType).toUpperCase() === String(rightType).toUpperCase() && Number(leftPeriod || 0) === Number(rightPeriod || 0)) {
      await sendTelegramMessage({ chatId, text: "Không tạo được: hai vế chỉ báo đang giống nhau.", parseMode: "" });
      return true;
    }
    await createIndicatorAlert(user._id, { type: "indicator_rule", symbol: normalizeSymbol(symbol), timeframe: normalizeTimeframe(timeframe), leftType: String(leftType).toUpperCase(), leftPeriod: Math.max(0, Number(leftPeriod || 0)), operator: operator || ">", rightType: String(rightType).toUpperCase(), rightPeriod: Math.max(0, Number(rightPeriod || 0)) });
    const leftLabel = Number(leftPeriod || 0) > 0 ? `${String(leftType).toUpperCase()}${Number(leftPeriod)}` : String(leftType).toUpperCase();
    const rightLabel = Number(rightPeriod || 0) > 0 ? `${String(rightType).toUpperCase()}${Number(rightPeriod)}` : String(rightType).toUpperCase();
    await sendTelegramMessage({ chatId, text: `Đã tạo indicator alert: ${symbol} ${timeframe} ${leftLabel} ${operator} ${rightLabel}`, parseMode: "" });
    return true;
  }

  const webCrossIntent = parseWebDrivenCrossIntent(text);
  if (webCrossIntent) {
    const result = await createCrossAlertsFromWebIndicators(user._id, state, webCrossIntent.leftType, webCrossIntent.rightType, webCrossIntent.requestedTimeframe, webCrossIntent.requestedSymbol);
    await sendTelegramMessage({
      chatId,
      text: [
        "Đã tạo cảnh báo giao cắt theo cấu hình chỉ báo đang bật trên web.",
        `Cặp chỉ báo: ${webCrossIntent.leftType} và ${webCrossIntent.rightType}`,
        `Mã/Khung: ${result.symbol} ${result.timeframe}`,
        `Chu kỳ ${webCrossIntent.leftType}: ${result.leftPeriods.join(", ")}`,
        `Chu kỳ ${webCrossIntent.rightType}: ${result.rightPeriods.join(", ")}`,
        `Tổng alert đã tạo: ${result.createdCount} (bao gồm cả cắt lên và cắt xuống).`,
      ].join("\n"),
      parseMode: "",
    });
    return true;
  }

  return false;
}
