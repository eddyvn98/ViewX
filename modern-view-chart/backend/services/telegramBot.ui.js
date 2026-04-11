import { editTelegramMessage, sendTelegramMessage } from "./telegram.js";
import { formatOperatorLabel, indicatorNeedsPeriod } from "./telegramBot.indicators.js";
import { normalizeMaType } from "./telegramBot.indicators.js";
import { escapeHtml, formatPrice } from "./telegramBot.helpers.js";
import { getActiveAlerts } from "./telegramBot.state.js";
import {
  TIMEFRAME_OPTIONS,
  SYMBOL_LIMIT,
  INDICATOR_TYPES,
  INDICATOR_COMPARE_OPERATORS,
  RSI_PERIOD_OPTIONS,
  RSI_THRESHOLD_OPTIONS,
  MA_TYPES,
  MA_FAST_PERIODS,
  MA_SLOW_PERIODS,
  WATCHLIST_FALLBACK,
} from "./telegramBot.constants.js";

// ─── Keyboard builders ───────────────────────────────────────────────────────

export function buildKeyboard(rows) {
  return { inline_keyboard: rows };
}

export function menuRootKeyboard() {
  return buildKeyboard([
    [
      { text: "Alert giá", callback_data: "tg:menu:price" },
      { text: "Alert chỉ báo", callback_data: "tg:menu:indicator" },
    ],
    [
      { text: "Alert RSI", callback_data: "tg:menu:rsi" },
      { text: "Alert MA cắt nhau", callback_data: "tg:menu:hma" },
    ],
    [
      { text: "Tín hiệu strategy", callback_data: "tg:menu:strategy" },
      { text: "Scanner / Matrix", callback_data: "tg:menu:scanner" },
    ],
    [{ text: "Quản lý alert", callback_data: "tg:menu:alerts" }],
    [{ text: "Làm mới menu", callback_data: "tg:menu:root" }],
  ]);
}

export function backKeyboard(target = "root") {
  return buildKeyboard([[{ text: "← Quay lại", callback_data: `tg:menu:${target}` }]]);
}

export function successKeyboard(section = "root") {
  return buildKeyboard([
    [
      { text: "Tạo thêm", callback_data: `tg:menu:${section}` },
      { text: "Quản lý alert", callback_data: "tg:menu:alerts" },
    ],
    [{ text: "Về menu chính", callback_data: "tg:menu:root" }],
  ]);
}

export function callbackKeyboard(callbackData) {
  return buildKeyboard([[{ text: "← Quay lại", callback_data: callbackData }]]);
}

export function symbolKeyboard(prefix, symbols, backTarget = "root") {
  const rows = [];
  for (let index = 0; index < symbols.length; index += 2) {
    rows.push(
      symbols.slice(index, index + 2).map((symbol) => ({
        text: symbol,
        callback_data: `${prefix}:${symbol}`,
      })),
    );
  }
  rows.push([{ text: "← Quay lại", callback_data: `tg:menu:${backTarget}` }]);
  return buildKeyboard(rows);
}

export function timeframeKeyboard(prefix, symbol, backTarget) {
  return buildKeyboard([
    TIMEFRAME_OPTIONS.slice(0, 2).map((tf) => ({ text: tf, callback_data: `${prefix}:${symbol}:${tf}` })),
    TIMEFRAME_OPTIONS.slice(2, 4).map((tf) => ({ text: tf, callback_data: `${prefix}:${symbol}:${tf}` })),
    [{ text: TIMEFRAME_OPTIONS[4], callback_data: `${prefix}:${symbol}:${TIMEFRAME_OPTIONS[4]}` }],
    [{ text: "← Quay lại", callback_data: `tg:menu:${backTarget}` }],
  ]);
}

// ─── Text builders ───────────────────────────────────────────────────────────

export function formatIndicatorAlertLabel(alert) {
  if (alert.type === "indicator_rule") {
    const leftType = String(alert.leftType || "PRICE").toUpperCase();
    const rightType = String(alert.rightType || "PRICE").toUpperCase();
    const leftPeriod = indicatorNeedsPeriod(leftType) ? Number(alert.leftPeriod || 0) : null;
    const rightPeriod = indicatorNeedsPeriod(rightType) ? Number(alert.rightPeriod || 0) : null;
    const leftLabel = leftPeriod ? `${leftType}${leftPeriod}` : leftType;
    const rightLabel = rightPeriod ? `${rightType}${rightPeriod}` : rightType;
    return `${leftLabel} ${formatOperatorLabel(alert.operator)} ${rightLabel} ${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)}`;
  }
  if (alert.type === "rsi") {
    return `RSI ${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)} (${Number(alert.period || 14)}) ${alert.condition === "lt" ? "<" : ">"} ${Number(alert.threshold || 0)}`;
  }
  if (alert.type === "ma_cross" || alert.type === "hma_ema") {
    const fastType = normalizeMaType(alert.fastType || "HMA");
    const slowType = normalizeMaType(alert.slowType || "EMA");
    const fastPeriod = Number(alert.fastPeriod || alert.hmaPeriod || 20);
    const slowPeriod = Number(alert.slowPeriod || alert.emaPeriod || 50);
    const direction = alert.direction === "bear" ? "cắt xuống" : "cắt lên";
    return `${fastType}${fastPeriod} ${direction} ${slowType}${slowPeriod} ${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)}`;
  }
  return `${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)}`;
}

export function buildMainMenuText(user, state) {
  const watchlist = Array.isArray(state?.watchlist) ? state.watchlist.slice(0, 3).join(", ") : "";
  return [
    `Xin chào <b>${escapeHtml(user.displayName || user.username || user.email || "trader")}</b>`,
    "",
    "Bot đang hỗ trợ thao tác nhanh bằng nút:",
    "• Tạo alert giá theo mã / khung thời gian",
    "• Tạo alert chỉ báo tổng quát theo comparator giống web",
    "• Tạo alert RSI với chu kỳ và ngưỡng tùy chọn",
    "• Tạo alert MA cắt nhau với loại MA và chu kỳ tùy chọn",
    "• Theo dõi tín hiệu vào/ra lệnh từ strategy trên web",
    "• Theo dõi scanner / matrix đang lưu trên web",
    "",
    `Watchlist nhanh: <b>${escapeHtml(watchlist || WATCHLIST_FALLBACK.join(", "))}</b>`,
  ].join("\n");
}

export function buildManagedAlertRows(state, botState) {
  const rows = [];
  for (const alert of getActiveAlerts(state)) {
    const operator = alert.type === "greater" ? ">" : alert.type === "less" ? "<" : "x";
    rows.push({ id: String(alert.id || ""), source: "price", label: `Gia ${alert.symbol} ${operator} ${formatPrice(alert.price)}` });
  }
  const indicatorAlerts = (Array.isArray(botState.indicatorAlerts) ? botState.indicatorAlerts : []).filter((item) => item?.active);
  for (const alert of indicatorAlerts) {
    rows.push({
      id: String(alert.id || ""),
      source: "indicator",
      label: formatIndicatorAlertLabel(alert).replaceAll("<b>", "").replaceAll("</b>", ""),
    });
  }
  return rows.filter((item) => item.id);
}

export function buildManageAlertsText(state, botState) {
  const priceAlerts = getActiveAlerts(state).slice(0, 5);
  const indicatorAlerts = (Array.isArray(botState.indicatorAlerts) ? botState.indicatorAlerts : []).filter((item) => item?.active).slice(0, 5);
  const lines = ["Alert đang bật", ""];
  if (!priceAlerts.length && !indicatorAlerts.length) {
    lines.push("Chưa có alert nào đang bật.");
    lines.push("Bạn có thể tạo nhanh alert giá, RSI hoặc MA ngay bên dưới.");
  }
  for (const alert of priceAlerts) {
    lines.push(`• Giá ${escapeHtml(alert.symbol)} ${alert.type === "greater" ? ">" : alert.type === "less" ? "<" : "x"} ${formatPrice(alert.price)}`);
  }
  for (const alert of indicatorAlerts) {
    lines.push(`• ${formatIndicatorAlertLabel(alert)}`);
  }
  return lines.join("\n");
}

export function buildManageAlertsKeyboard(state, botState) {
  const rows = [[
    { text: "Thêm alert giá", callback_data: "tg:menu:price" },
    { text: "Thêm RSI", callback_data: "tg:menu:rsi" },
  ], [
    { text: "Thêm chỉ báo", callback_data: "tg:menu:indicator" },
    { text: "Thêm MA", callback_data: "tg:menu:hma" },
  ]];
  for (const alert of getActiveAlerts(state).slice(0, 4)) {
    rows.push([{ text: `Xóa alert giá ${alert.symbol}`, callback_data: `tg:alert:del:${alert.id}` }]);
  }
  for (const alert of (Array.isArray(botState.indicatorAlerts) ? botState.indicatorAlerts : []).filter((item) => item?.active).slice(0, 4)) {
    rows.push([{ text: `Xóa ${alert.type === "rsi" ? "RSI" : "MA"} ${alert.symbol}`, callback_data: `tg:alert:del:${alert.id}` }]);
  }
  rows.push([{ text: "← Quay lại", callback_data: "tg:menu:root" }]);
  return buildKeyboard(rows);
}

export function buildTextCommandHelp() {
  return [
    "Bạn có thể tạo alert bằng tin nhắn, không cần bấm nút.",
    "",
    "Mẫu lệnh nhanh:",
    "1) Gia theo %: BTCUSDT 5m up 1%",
    "2) Gia muc cu the: BTCUSDT 1h > 70000",
    "3) RSI: rsi BTCUSDT 15m 14 < 30",
    "4) MA cat nhau: ma BTCUSDT 1h EMA20 cross up EMA50",
    "5) Chỉ báo tổng quát: indicator BTCUSDT 1h EMA20 crosses_above EMA50",
    "6) Dùng thông số đang bật trên web: cảnh báo khi hma và ema giao cắt nhau",
    "7) Xem alert: /alerts",
    "8) Xóa alert: delete alert #2 hoặc delete alert <id>",
    "",
    "Lenh menu: /menu",
  ].join("\n");
}

export function buildTextAlertsSummary(state, botState) {
  const rows = buildManagedAlertRows(state, botState);
  if (!rows.length) return "Chua co alert dang bat.\nNhan /help de xem cau truc lenh tao alert bang tin nhan.";
  const lines = ["Danh sach alert dang bat:"];
  rows.slice(0, 20).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.label} [id: ${item.id}]`);
  });
  if (rows.length > 20) lines.push(`... con ${rows.length - 20} alert nua.`);
  return lines.join("\n");
}

// ─── Menu sending ─────────────────────────────────────────────────────────────

export async function sendOrEditMenu({ chatId, messageId, text, replyMarkup }) {
  if (messageId) {
    const edited = await editTelegramMessage({ chatId, messageId, text, replyMarkup });
    if (edited.ok) return edited;
  }
  return sendTelegramMessage({ chatId, text, parseMode: "HTML", disableWebPagePreview: true, replyMarkup });
}

export async function sendMainMenu({ user, state, chatId, messageId }) {
  return sendOrEditMenu({
    chatId,
    messageId,
    text: buildMainMenuText(user, state),
    replyMarkup: menuRootKeyboard(),
  });
}
