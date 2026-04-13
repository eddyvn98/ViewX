import { editTelegramMessage, sendTelegramMessage } from "./telegram.js";
import { formatOperatorLabel, indicatorNeedsPeriod } from "./telegramBot.indicators.js";
import { normalizeMaType } from "./telegramBot.indicators.js";
import { escapeHtml, formatPrice } from "./telegramBot.helpers.js";
import { getActiveAlerts } from "./telegramBot.state.js";
import {
  TIMEFRAME_OPTIONS,
  INDICATOR_TYPES,
  INDICATOR_COMPARE_OPERATORS,
  RSI_PERIOD_OPTIONS,
  WATCHLIST_FALLBACK,
} from "./telegramBot.constants.js";

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
    rows.push({ id: String(alert.id || ""), source: "price", label: `Giá ${alert.symbol} ${operator} ${formatPrice(alert.price)}` });
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
    "Menu / Help / Danh sách:",
    "- Menu: /menu | menu | /m",
    "- Help: /help | help | trợ giúp | tro giup | /h | ?",
    "- List alerts: /alerts | list alerts | danh sách cảnh báo | danh sach canh bao | /la | /ls",
    "- Delete all: xóa tất cả cảnh báo | xoa tat ca canh bao | delete all alerts | /da | /clr",
    "",
    "Cảnh báo giá (%):",
    "- VN có dấu: eth 15m tăng 2%",
    "- VN không dấu: eth m15 giam 1.5%",
    "- EN: ETHUSD 15m up 2%",
    "- Viết tắt: pp ETHUSD h1 down 3%",
    "",
    "Cảnh báo giá (mốc giá):",
    "- VN có dấu: vàng 1h > 2450",
    "- VN không dấu: vang 1h > 2450",
    "- EN: gold h1 < 2400",
    "- Viết tắt: pa BTCUSD m15 >= 70000",
    "",
    "RSI:",
    "- VN có dấu: rsi btc h1 14 > 70",
    "- VN không dấu: rsi btc h1 14 < 30",
    "- EN: rsi eth 15m 14 < 30",
    "- Viết tắt: ra BTCUSD m15 14 < 35",
    "",
    "MA cross:",
    "- VN có dấu: cảnh báo khi ema20 cắt lên ema50 btc khung m15",
    "- VN không dấu: canh bao khi ema20 cat len ema50 btc khung m15",
    "- EN: ma xauusd m15 hma20 cross down hma100",
    "",
    "Indicator rule (tùy biến):",
    "- EN: indicator BTCUSD h1 EMA20 crosses_above EMA50",
    "- VN có dấu: indicator xauusd m15 hma20 > ema50",
    "- VN không dấu: indicator xauusd m15 hma20 > ema50",
    "- Viết tắt: ia ETHUSD m15 EMA20 > EMA50",
    "",
    "Scanner/Matrix:",
    "- VN có dấu: cho xem matrix 1",
    "- VN không dấu: cho xem ma tran 1",
    "- EN: show scanner 2",
    "- Viết tắt: /mx | /sc",
    "",
    "Xóa 1 alert:",
    "- xóa alert #2",
    "- delete alert #2",
    "- xoa alert #3",
    "- delete alert <id>",
    "",
    "Lệnh đặc biệt theo chart web (active pair):",
    "- Cảnh báo khi 2 đường này cắt nhau khung m15",
    "- Canh bao khi 2 duong nay cat nhau khung m15",
  ].join("\n");
}

export function buildTextAlertsSummary(state, botState) {
  const rows = buildManagedAlertRows(state, botState);
  if (!rows.length) return "Chưa có alert đang bật.\nNhấn /help để xem cấu trúc lệnh tạo alert bằng tin nhắn.";
  const lines = ["Danh sách alert đang bật:"];
  rows.slice(0, 20).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.label} [id: ${item.id}]`);
  });
  if (rows.length > 20) lines.push(`... còn ${rows.length - 20} alert nữa.`);
  return lines.join("\n");
}

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

export {
  INDICATOR_TYPES,
  INDICATOR_COMPARE_OPERATORS,
  RSI_PERIOD_OPTIONS,
};
