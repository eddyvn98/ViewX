import { userModel } from "../model/user.js";
import { answerTelegramCallbackQuery } from "./telegram.js";
import { formatOperatorLabel, indicatorNeedsPeriod, getIndicatorPeriodOptions } from "./telegramBot.indicators.js";
import { normalizeMaType } from "./telegramBot.indicators.js";
import { normalizeSymbol, normalizeTimeframe, escapeHtml, formatPrice } from "./telegramBot.helpers.js";
import { normalizeBotState, loadUserSetupState, getStrategies, getSignals, getScanners, getQuickSymbols } from "./telegramBot.state.js";
import { renderSignalsText, sendScannerMatrixSnapshot, renderScannerMatrixText } from "./telegramBot.context.js";
import {
  buildKeyboard, backKeyboard, successKeyboard, callbackKeyboard,
  symbolKeyboard, timeframeKeyboard, sendOrEditMenu, sendMainMenu,
  buildManageAlertsText, buildManageAlertsKeyboard,
} from "./telegramBot.ui.js";
import { createPriceAlert, createIndicatorAlert, deleteManagedAlert, toggleStrategySubscription, toggleScannerSubscription } from "./telegramBot.alerts.js";
import {
  INDICATOR_TYPES, INDICATOR_COMPARE_OPERATORS,
  RSI_PERIOD_OPTIONS, RSI_THRESHOLD_OPTIONS,
  MA_TYPES, MA_FAST_PERIODS, MA_SLOW_PERIODS,
} from "./telegramBot.constants.js";

// ─── Menu sections ────────────────────────────────────────────────────────────

export async function handleMenuAction({ user, state, chatId, messageId, section }) {
  const symbols = getQuickSymbols(state || {});

  if (section === "root") return sendMainMenu({ user, state, chatId, messageId });

  if (section === "price") {
    return sendOrEditMenu({ chatId, messageId, text: "Tạo alert giá\n\nChọn symbol cần theo dõi:", replyMarkup: symbolKeyboard("tg:price:sym", symbols, "root") });
  }
  if (section === "indicator") {
    return sendOrEditMenu({ chatId, messageId, text: "Tạo alert chỉ báo\n\nLuồng này bám kiểu comparator của web: chỉ báo trái, toán tử, chỉ báo phải.\n\nChọn mã cần theo dõi:", replyMarkup: symbolKeyboard("tg:ind:sym", symbols, "root") });
  }
  if (section === "rsi") {
    return sendOrEditMenu({ chatId, messageId, text: "Tạo alert RSI\n\nChọn symbol, sau đó bot sẽ cho chọn chu kỳ và ngưỡng:", replyMarkup: symbolKeyboard("tg:rsi:sym", symbols, "root") });
  }
  if (section === "hma") {
    return sendOrEditMenu({ chatId, messageId, text: "Tạo alert MA cắt nhau\n\nChọn symbol, sau đó bot sẽ cho chọn loại MA và chu kỳ:", replyMarkup: symbolKeyboard("tg:hma:sym", symbols, "root") });
  }
  if (section === "strategy") {
    const strategies = getStrategies(state);
    const botState = normalizeBotState(user.telegram?.botState);
    const subscribed = new Set((botState.strategySubscriptions || []).filter((item) => item?.active).map((item) => item.strategyId));
    const rows = strategies.slice(0, 8).map((strategy, index) => ([{ text: `${subscribed.has(strategy.id) ? "✅" : "⬜"} ${strategy.name || strategy.id}`, callback_data: `tg:strat:toggle:${index}` }]));
    rows.push([{ text: "Xem tín hiệu mới nhất", callback_data: "tg:strat:view" }]);
    rows.push([{ text: "← Quay lại", callback_data: "tg:menu:root" }]);
    return sendOrEditMenu({ chatId, messageId, text: "Tín hiệu strategy\n\nBật/tắt theo dõi strategy đã build trên web.", replyMarkup: buildKeyboard(rows) });
  }
  if (section === "scanner") {
    const scanners = getScanners(state);
    const botState = normalizeBotState(user.telegram?.botState);
    const subscribed = new Set((botState.scannerSubscriptions || []).filter((item) => item?.active).map((item) => item.scannerId));
    const rows = scanners.slice(0, 6).flatMap((scanner, index) => ([
      [{ text: `${subscribed.has(scanner.id) ? "✅" : "⬜"} ${scanner.name || `Scanner ${index + 1}`}`, callback_data: `tg:scan:toggle:${index}` }],
      [{ text: `Xem ${scanner.name || `Scanner ${index + 1}`}`, callback_data: `tg:scan:view:${index}` }],
    ]));
    rows.push([{ text: "← Quay lại", callback_data: "tg:menu:root" }]);
    return sendOrEditMenu({ chatId, messageId, text: "Scanner / Matrix\n\nTheo dõi scanner đang persist từ web hoặc xem nhanh trạng thái tín hiệu.", replyMarkup: buildKeyboard(rows) });
  }
  if (section === "alerts") {
    const botState = normalizeBotState(user.telegram?.botState);
    return sendOrEditMenu({ chatId, messageId, text: buildManageAlertsText(state, botState), replyMarkup: buildManageAlertsKeyboard(state, botState) });
  }
  return sendMainMenu({ user, state, chatId, messageId });
}

// ─── Callback dispatcher ──────────────────────────────────────────────────────

export async function handleCallback({ user, state, chatId, messageId, callbackQueryId, data }) {
  const parts = String(data || "").split(":");
  if (parts[0] !== "tg") return null;
  const group = parts[1];

  if (group === "menu") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    return handleMenuAction({ user, state, chatId, messageId, section: parts[2] || "root" });
  }

  // ── Price ──────────────────────────────────────────────────────────────────
  if (group === "price" && parts[2] === "sym") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    return sendOrEditMenu({ chatId, messageId, text: `Alert giá\n\nMã: <b>${escapeHtml(symbol)}</b>\nChọn khung thời gian:`, replyMarkup: timeframeKeyboard("tg:price:tf", symbol, "price") });
  }
  if (group === "price" && parts[2] === "tf") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert giá\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChọn hướng cảnh báo:`,
      replyMarkup: buildKeyboard([
        [{ text: "Giá tăng vượt mức", callback_data: `tg:price:dir:${symbol}:${timeframe}:gt` }],
        [{ text: "Giá giảm xuống dưới mức", callback_data: `tg:price:dir:${symbol}:${timeframe}:lt` }],
        [{ text: "← Quay lại", callback_data: `tg:price:sym:${symbol}` }],
      ]),
    });
  }
  if (group === "price" && parts[2] === "dir") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const direction = parts[5] === "lt" ? "lt" : "gt";
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert giá\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChọn mức nhanh theo % so với giá hiện tại:`,
      replyMarkup: buildKeyboard([
        [
          { text: direction === "gt" ? "+0.25%" : "-0.25%", callback_data: `tg:price:add:${symbol}:${timeframe}:${direction}:0.25` },
          { text: direction === "gt" ? "+0.5%" : "-0.5%", callback_data: `tg:price:add:${symbol}:${timeframe}:${direction}:0.5` },
        ],
        [
          { text: direction === "gt" ? "+1.0%" : "-1.0%", callback_data: `tg:price:add:${symbol}:${timeframe}:${direction}:1` },
          { text: direction === "gt" ? "+2.0%" : "-2.0%", callback_data: `tg:price:add:${symbol}:${timeframe}:${direction}:2` },
        ],
        [{ text: "← Quay lại", callback_data: `tg:price:tf:${symbol}:${timeframe}` }],
      ]),
    });
  }
  if (group === "price" && parts[2] === "add") {
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const direction = parts[5] === "lt" ? "lt" : "gt";
    const percent = Number(parts[6] || 0.5);
    try {
      const created = await createPriceAlert(user._id, symbol, timeframe, direction, percent);
      await answerTelegramCallbackQuery({ callbackQueryId, text: "Đã tạo alert giá" });
      return sendOrEditMenu({
        chatId, messageId,
        text: ["✅ Đã tạo alert giá", "", `Mã: <b>${escapeHtml(symbol)}</b>`, `Khung thời gian: <b>${escapeHtml(timeframe)}</b>`, `Giá hiện tại: <b>${formatPrice(created.currentPrice)}</b>`, `Mức cảnh báo: <b>${formatPrice(created.targetPrice)}</b>`].join("\n"),
        replyMarkup: successKeyboard("price"),
      });
    } catch (error) {
      await answerTelegramCallbackQuery({ callbackQueryId, text: error?.message || "Không tạo được alert", showAlert: true });
      return sendOrEditMenu({ chatId, messageId, text: error?.message || "Không tạo được alert giá.", replyMarkup: backKeyboard("price") });
    }
  }

  // ── Indicator ──────────────────────────────────────────────────────────────
  if (group === "ind" && parts[2] === "sym") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    return sendOrEditMenu({ chatId, messageId, text: `Alert chỉ báo\n\nMã: <b>${escapeHtml(symbol)}</b>\nChọn khung thời gian:`, replyMarkup: timeframeKeyboard("tg:ind:tf", symbol, "indicator") });
  }
  if (group === "ind" && parts[2] === "tf") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChọn chỉ báo bên trái:`,
      replyMarkup: buildKeyboard([
        INDICATOR_TYPES.slice(0, 3).map((v) => ({ text: v === "PRICE" ? "Giá" : v, callback_data: `tg:ind:lefttype:${symbol}:${timeframe}:${v}` })),
        INDICATOR_TYPES.slice(3).map((v) => ({ text: v === "PRICE" ? "Giá" : v, callback_data: `tg:ind:lefttype:${symbol}:${timeframe}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:ind:sym:${symbol}` }],
      ]),
    });
  }
  if (group === "ind" && parts[2] === "lefttype") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const leftType = String(parts[5] || "PRICE").toUpperCase();
    if (!indicatorNeedsPeriod(leftType)) {
      return sendOrEditMenu({
        chatId, messageId,
        text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChỉ báo trái: <b>${leftType === "PRICE" ? "Giá" : leftType}</b>\nChọn toán tử:`,
        replyMarkup: buildKeyboard([
          INDICATOR_COMPARE_OPERATORS.slice(0, 2).map((v) => ({ text: formatOperatorLabel(v), callback_data: `tg:ind:op:${symbol}:${timeframe}:${leftType}:0:${v}` })),
          INDICATOR_COMPARE_OPERATORS.slice(2).map((v) => ({ text: formatOperatorLabel(v), callback_data: `tg:ind:op:${symbol}:${timeframe}:${leftType}:0:${v}` })),
          [{ text: "← Quay lại", callback_data: `tg:ind:tf:${symbol}:${timeframe}` }],
        ]),
      });
    }
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChỉ báo trái: <b>${leftType}</b>\nChọn chu kỳ:`,
      replyMarkup: buildKeyboard([
        getIndicatorPeriodOptions(leftType).slice(0, 3).map((v) => ({ text: `${leftType} ${v}`, callback_data: `tg:ind:leftperiod:${symbol}:${timeframe}:${leftType}:${v}` })),
        getIndicatorPeriodOptions(leftType).slice(3).map((v) => ({ text: `${leftType} ${v}`, callback_data: `tg:ind:leftperiod:${symbol}:${timeframe}:${leftType}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:ind:tf:${symbol}:${timeframe}` }],
      ]),
    });
  }
  if (group === "ind" && parts[2] === "leftperiod") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const leftType = String(parts[5] || "PRICE").toUpperCase();
    const leftPeriod = Math.max(0, Number(parts[6] || 0));
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChỉ báo trái: <b>${leftType}${leftPeriod}</b>\nChọn toán tử:`,
      replyMarkup: buildKeyboard([
        INDICATOR_COMPARE_OPERATORS.slice(0, 2).map((v) => ({ text: formatOperatorLabel(v), callback_data: `tg:ind:op:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${v}` })),
        INDICATOR_COMPARE_OPERATORS.slice(2).map((v) => ({ text: formatOperatorLabel(v), callback_data: `tg:ind:op:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:ind:lefttype:${symbol}:${timeframe}:${leftType}` }],
      ]),
    });
  }
  if (group === "ind" && parts[2] === "op") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const leftType = String(parts[5] || "PRICE").toUpperCase();
    const leftPeriod = Math.max(0, Number(parts[6] || 0));
    const operator = String(parts[7] || ">");
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nVế trái: <b>${leftPeriod ? `${leftType}${leftPeriod}` : leftType}</b>\nToán tử: <b>${formatOperatorLabel(operator)}</b>\nChọn chỉ báo bên phải:`,
      replyMarkup: buildKeyboard([
        INDICATOR_TYPES.slice(0, 3).map((v) => ({ text: v === "PRICE" ? "Giá" : v, callback_data: `tg:ind:righttype:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${v}` })),
        INDICATOR_TYPES.slice(3).map((v) => ({ text: v === "PRICE" ? "Giá" : v, callback_data: `tg:ind:righttype:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${v}` })),
        [{ text: "← Quay lại", callback_data: indicatorNeedsPeriod(leftType) ? `tg:ind:leftperiod:${symbol}:${timeframe}:${leftType}:${leftPeriod}` : `tg:ind:lefttype:${symbol}:${timeframe}:${leftType}` }],
      ]),
    });
  }
  if (group === "ind" && parts[2] === "righttype") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const leftType = String(parts[5] || "PRICE").toUpperCase();
    const leftPeriod = Math.max(0, Number(parts[6] || 0));
    const operator = String(parts[7] || ">");
    const rightType = String(parts[8] || "PRICE").toUpperCase();
    if (!indicatorNeedsPeriod(rightType)) {
      return sendOrEditMenu({
        chatId, messageId,
        text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nVế trái: <b>${leftPeriod ? `${leftType}${leftPeriod}` : leftType}</b>\nToán tử: <b>${formatOperatorLabel(operator)}</b>\nVế phải: <b>${rightType === "PRICE" ? "Giá" : rightType}</b>\nXác nhận tạo alert:`,
        replyMarkup: buildKeyboard([
          [{ text: "Tạo alert", callback_data: `tg:ind:add:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${rightType}:0` }],
          [{ text: "← Quay lại", callback_data: `tg:ind:op:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}` }],
        ]),
      });
    }
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nVế phải: <b>${rightType}</b>\nChọn chu kỳ vế phải:`,
      replyMarkup: buildKeyboard([
        getIndicatorPeriodOptions(rightType).slice(0, 3).map((v) => ({ text: `${rightType} ${v}`, callback_data: `tg:ind:rightperiod:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${rightType}:${v}` })),
        getIndicatorPeriodOptions(rightType).slice(3).map((v) => ({ text: `${rightType} ${v}`, callback_data: `tg:ind:rightperiod:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${rightType}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:ind:op:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}` }],
      ]),
    });
  }
  if (group === "ind" && parts[2] === "rightperiod") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const leftType = String(parts[5] || "PRICE").toUpperCase();
    const leftPeriod = Math.max(0, Number(parts[6] || 0));
    const operator = String(parts[7] || ">");
    const rightType = String(parts[8] || "PRICE").toUpperCase();
    const rightPeriod = Math.max(0, Number(parts[9] || 0));
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nVế trái: <b>${leftPeriod ? `${leftType}${leftPeriod}` : leftType}</b>\nToán tử: <b>${formatOperatorLabel(operator)}</b>\nVế phải: <b>${rightType}${rightPeriod}</b>\nXác nhận tạo alert:`,
      replyMarkup: buildKeyboard([
        [{ text: "Tạo alert", callback_data: `tg:ind:add:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${rightType}:${rightPeriod}` }],
        [{ text: "← Quay lại", callback_data: `tg:ind:righttype:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${rightType}` }],
      ]),
    });
  }
  if (group === "ind" && parts[2] === "add") {
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const leftType = String(parts[5] || "PRICE").toUpperCase();
    const leftPeriod = Math.max(0, Number(parts[6] || 0));
    const operator = String(parts[7] || ">");
    const rightType = String(parts[8] || "PRICE").toUpperCase();
    const rightPeriod = Math.max(0, Number(parts[9] || 0));
    if (leftType === rightType && leftPeriod === rightPeriod) {
      await answerTelegramCallbackQuery({ callbackQueryId, text: "Hai vế đang giống hệt nhau.", showAlert: true });
      return sendOrEditMenu({ chatId, messageId, text: "Cấu hình chưa hợp lệ vì hai vế đang giống nhau hoàn toàn. Hãy chọn lại để alert có ý nghĩa.", replyMarkup: callbackKeyboard(`tg:ind:righttype:${symbol}:${timeframe}:${leftType}:${leftPeriod}:${operator}:${rightType}`) });
    }
    await createIndicatorAlert(user._id, { type: "indicator_rule", symbol, timeframe, leftType, leftPeriod, operator, rightType, rightPeriod });
    await answerTelegramCallbackQuery({ callbackQueryId, text: "Đã lưu alert chỉ báo" });
    return sendOrEditMenu({
      chatId, messageId,
      text: `✅ Đã tạo alert chỉ báo\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nĐiều kiện: <b>${leftPeriod ? `${leftType}${leftPeriod}` : leftType} ${formatOperatorLabel(operator).toLowerCase()} ${rightPeriod ? `${rightType}${rightPeriod}` : rightType}</b>`,
      replyMarkup: successKeyboard("indicator"),
    });
  }

  // ── RSI ────────────────────────────────────────────────────────────────────
  if (group === "rsi" && parts[2] === "sym") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    return sendOrEditMenu({ chatId, messageId, text: `Alert RSI\n\nMã: <b>${escapeHtml(symbol)}</b>\nChọn khung thời gian:`, replyMarkup: timeframeKeyboard("tg:rsi:tf", symbol, "rsi") });
  }
  if (group === "rsi" && parts[2] === "tf") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert RSI\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChọn chu kỳ RSI:`,
      replyMarkup: buildKeyboard([
        RSI_PERIOD_OPTIONS.map((v) => ({ text: `RSI ${v}`, callback_data: `tg:rsi:period:${symbol}:${timeframe}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:rsi:sym:${symbol}` }],
      ]),
    });
  }
  if (group === "rsi" && parts[2] === "period") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const period = Math.max(2, Number(parts[5] || 14));
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert RSI\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChu kỳ: <b>${period}</b>\nChọn điều kiện:`,
      replyMarkup: buildKeyboard([
        [{ text: "RSI vượt lên trên ngưỡng", callback_data: `tg:rsi:cond:${symbol}:${timeframe}:${period}:gt` }],
        [{ text: "RSI rơi xuống dưới ngưỡng", callback_data: `tg:rsi:cond:${symbol}:${timeframe}:${period}:lt` }],
        [{ text: "← Quay lại", callback_data: `tg:rsi:tf:${symbol}:${timeframe}` }],
      ]),
    });
  }
  if (group === "rsi" && parts[2] === "cond") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const period = Math.max(2, Number(parts[5] || 14));
    const condition = parts[6] === "lt" ? "lt" : "gt";
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert RSI\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChu kỳ: <b>${period}</b>\nĐiều kiện: <b>${condition === "gt" ? "vượt lên" : "rơi xuống"}</b>\nChọn ngưỡng:`,
      replyMarkup: buildKeyboard([
        RSI_THRESHOLD_OPTIONS.slice(0, 3).map((v) => ({ text: `RSI ${condition === "gt" ? ">" : "<"} ${v}`, callback_data: `tg:rsi:add:${symbol}:${timeframe}:${period}:${condition}:${v}` })),
        RSI_THRESHOLD_OPTIONS.slice(3).map((v) => ({ text: `RSI ${condition === "gt" ? ">" : "<"} ${v}`, callback_data: `tg:rsi:add:${symbol}:${timeframe}:${period}:${condition}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:rsi:period:${symbol}:${timeframe}:${period}` }],
      ]),
    });
  }
  if (group === "rsi" && parts[2] === "add") {
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const period = Math.max(2, Number(parts[5] || 14));
    const condition = parts[6] === "lt" ? "lt" : "gt";
    const threshold = Number(parts[7] || 70);
    await createIndicatorAlert(user._id, { type: "rsi", symbol, timeframe, condition, threshold, period });
    await answerTelegramCallbackQuery({ callbackQueryId, text: "Đã lưu alert RSI" });
    return sendOrEditMenu({
      chatId, messageId,
      text: `✅ Đã tạo alert RSI\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nĐiều kiện: <b>RSI(${period}) ${condition === "gt" ? ">" : "<"} ${threshold}</b>`,
      replyMarkup: successKeyboard("rsi"),
    });
  }

  // ── HMA/MA cross ───────────────────────────────────────────────────────────
  if (group === "hma" && parts[2] === "sym") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    return sendOrEditMenu({ chatId, messageId, text: `Alert MA cắt nhau\n\nMã: <b>${escapeHtml(symbol)}</b>\nChọn khung thời gian:`, replyMarkup: timeframeKeyboard("tg:hma:tf", symbol, "hma") });
  }
  if (group === "hma" && parts[2] === "tf") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert MA cắt nhau\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nChọn loại MA nhanh:`,
      replyMarkup: buildKeyboard([
        MA_TYPES.map((v) => ({ text: `MA nhanh: ${v}`, callback_data: `tg:hma:fasttype:${symbol}:${timeframe}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:hma:sym:${symbol}` }],
      ]),
    });
  }
  if (group === "hma" && parts[2] === "fasttype") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const fastType = normalizeMaType(parts[5]);
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert MA cắt nhau\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nMA nhanh: <b>${fastType}</b>\nChọn chu kỳ MA nhanh:`,
      replyMarkup: buildKeyboard([
        MA_FAST_PERIODS.map((v) => ({ text: `${fastType} ${v}`, callback_data: `tg:hma:fastperiod:${symbol}:${timeframe}:${fastType}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:hma:tf:${symbol}:${timeframe}` }],
      ]),
    });
  }
  if (group === "hma" && parts[2] === "fastperiod") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const fastType = normalizeMaType(parts[5]);
    const fastPeriod = Math.max(2, Number(parts[6] || 9));
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert MA cắt nhau\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nMA nhanh: <b>${fastType} ${fastPeriod}</b>\nChọn loại MA chậm:`,
      replyMarkup: buildKeyboard([
        MA_TYPES.map((v) => ({ text: `MA chậm: ${v}`, callback_data: `tg:hma:slowtype:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:hma:fasttype:${symbol}:${timeframe}:${fastType}` }],
      ]),
    });
  }
  if (group === "hma" && parts[2] === "slowtype") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const fastType = normalizeMaType(parts[5]);
    const fastPeriod = Math.max(2, Number(parts[6] || 9));
    const slowType = normalizeMaType(parts[7]);
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert MA cắt nhau\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nMA nhanh: <b>${fastType} ${fastPeriod}</b>\nMA chậm: <b>${slowType}</b>\nChọn chu kỳ MA chậm:`,
      replyMarkup: buildKeyboard([
        MA_SLOW_PERIODS.slice(0, 2).map((v) => ({ text: `${slowType} ${v}`, callback_data: `tg:hma:slowperiod:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${slowType}:${v}` })),
        MA_SLOW_PERIODS.slice(2).map((v) => ({ text: `${slowType} ${v}`, callback_data: `tg:hma:slowperiod:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${slowType}:${v}` })),
        [{ text: "← Quay lại", callback_data: `tg:hma:fastperiod:${symbol}:${timeframe}:${fastType}:${fastPeriod}` }],
      ]),
    });
  }
  if (group === "hma" && parts[2] === "slowperiod") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const fastType = normalizeMaType(parts[5]);
    const fastPeriod = Math.max(2, Number(parts[6] || 9));
    const slowType = normalizeMaType(parts[7]);
    const slowPeriod = Math.max(2, Number(parts[8] || 20));
    return sendOrEditMenu({
      chatId, messageId,
      text: `Alert MA cắt nhau\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nMA nhanh: <b>${fastType} ${fastPeriod}</b>\nMA chậm: <b>${slowType} ${slowPeriod}</b>\nChọn hướng cắt:`,
      replyMarkup: buildKeyboard([
        [{ text: `${fastType} cắt lên ${slowType}`, callback_data: `tg:hma:add:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${slowType}:${slowPeriod}:bull` }],
        [{ text: `${fastType} cắt xuống ${slowType}`, callback_data: `tg:hma:add:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${slowType}:${slowPeriod}:bear` }],
        [{ text: "← Quay lại", callback_data: `tg:hma:slowtype:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${slowType}` }],
      ]),
    });
  }
  if (group === "hma" && parts[2] === "add") {
    const symbol = normalizeSymbol(parts[3]);
    const timeframe = normalizeTimeframe(parts[4]);
    const fastType = normalizeMaType(parts[5]);
    const fastPeriod = Math.max(2, Number(parts[6] || 9));
    const slowType = normalizeMaType(parts[7]);
    const slowPeriod = Math.max(2, Number(parts[8] || 20));
    const direction = parts[9] === "bear" ? "bear" : "bull";
    if (fastType === slowType && fastPeriod === slowPeriod) {
      await answerTelegramCallbackQuery({ callbackQueryId, text: "MA nhanh và MA chậm đang giống hệt nhau.", showAlert: true });
      return sendOrEditMenu({ chatId, messageId, text: `Cấu hình chưa hợp lệ.\n\nBạn đang chọn cùng một đường MA cho cả nhanh và chậm: <b>${fastType}${fastPeriod}</b>.\nHãy chọn cấu hình khác để tạo alert cắt nhau.`, replyMarkup: callbackKeyboard(`tg:hma:slowperiod:${symbol}:${timeframe}:${fastType}:${fastPeriod}:${slowType}:${slowPeriod}`) });
    }
    await createIndicatorAlert(user._id, { type: "ma_cross", symbol, timeframe, fastType, fastPeriod, slowType, slowPeriod, direction });
    await answerTelegramCallbackQuery({ callbackQueryId, text: "Đã lưu alert MA" });
    return sendOrEditMenu({
      chatId, messageId,
      text: `✅ Đã tạo alert MA cắt nhau\n\n${escapeHtml(symbol)} ${escapeHtml(timeframe)}\nĐiều kiện: <b>${fastType}${fastPeriod} ${direction === "bull" ? "cắt lên" : "cắt xuống"} ${slowType}${slowPeriod}</b>`,
      replyMarkup: successKeyboard("hma"),
    });
  }

  // ── Strategy ───────────────────────────────────────────────────────────────
  if (group === "strat" && parts[2] === "toggle") {
    const index = Number(parts[3] || -1);
    try {
      const result = await toggleStrategySubscription(user._id, state, index);
      await answerTelegramCallbackQuery({ callbackQueryId, text: result.active ? "Đã bật theo dõi" : "Đã tắt theo dõi" });
      const nextState = await loadUserSetupState(user._id);
      const freshUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
      return handleMenuAction({ user: freshUser || user, state: nextState.state, chatId, messageId, section: "strategy" });
    } catch (error) {
      await answerTelegramCallbackQuery({ callbackQueryId, text: error?.message || "Không xử lý được", showAlert: true });
      return null;
    }
  }
  if (group === "strat" && parts[2] === "view") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    return sendOrEditMenu({ chatId, messageId, text: renderSignalsText("Tín hiệu strategy mới nhất", getSignals(state).slice(0, 8), state), replyMarkup: backKeyboard("strategy") });
  }

  // ── Scanner ────────────────────────────────────────────────────────────────
  if (group === "scan" && parts[2] === "toggle") {
    const index = Number(parts[3] || -1);
    try {
      const result = await toggleScannerSubscription(user._id, state, index);
      await answerTelegramCallbackQuery({ callbackQueryId, text: result.active ? "Đã bật theo dõi scanner" : "Đã tắt theo dõi scanner" });
      const nextState = await loadUserSetupState(user._id);
      const freshUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
      return handleMenuAction({ user: freshUser || user, state: nextState.state, chatId, messageId, section: "scanner" });
    } catch (error) {
      await answerTelegramCallbackQuery({ callbackQueryId, text: error?.message || "Không xử lý được", showAlert: true });
      return null;
    }
  }
  if (group === "scan" && parts[2] === "view") {
    await answerTelegramCallbackQuery({ callbackQueryId });
    const index = Number(parts[3] || -1);
    const scanner = getScanners(state)[index];
    if (!scanner) {
      return sendOrEditMenu({ chatId, messageId, text: "Không tìm thấy scanner.", replyMarkup: backKeyboard("scanner") });
    }
    const snap = await sendScannerMatrixSnapshot(chatId, scanner, state, `Snapshot: ${scanner.name || scanner.id}`);
    return sendOrEditMenu({
      chatId, messageId,
      text: snap?.ok ? `Đã gửi snapshot bảng theo dõi cho <b>${escapeHtml(scanner.name || scanner.id)}</b>.\n\n${renderScannerMatrixText(scanner, state)}` : renderScannerMatrixText(scanner, state),
      replyMarkup: backKeyboard("scanner"),
    });
  }

  // ── Alert delete ───────────────────────────────────────────────────────────
  if (group === "alert" && parts[2] === "del") {
    const removed = await deleteManagedAlert(user._id, parts[3]);
    await answerTelegramCallbackQuery({ callbackQueryId, text: removed ? "Đã xóa alert" : "Không tìm thấy alert" });
    const nextState = await loadUserSetupState(user._id);
    const nextUser = await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess");
    return handleMenuAction({ user: nextUser || user, state: nextState.state, chatId, messageId, section: "alerts" });
  }

  await answerTelegramCallbackQuery({ callbackQueryId, text: "Chưa hỗ trợ thao tác này" });
  return sendMainMenu({ user, state, chatId, messageId });
}
