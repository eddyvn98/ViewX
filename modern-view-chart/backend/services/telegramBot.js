import { userModel } from "../model/user.js";
import { answerTelegramCallbackQuery, sendTelegramMessage } from "./telegram.js";
import { loadUserSetupState } from "./telegramBot.state.js";
import { sendMainMenu } from "./telegramBot.ui.js";
import { handleCallback } from "./telegramBot.callback.js";
import { handleTextIntent } from "./telegramBot.textIntent.js";
export { hasTelegramModuleAccess } from "./telegramBot.access.js";
export { startTelegramBotMonitor } from "./telegramBot.monitor.js";

import { hasTelegramModuleAccess } from "./telegramBot.access.js";
import { logError } from "../logger.js";

export async function handleTelegramBotUpdate({ message, callbackQuery }) {
  const chatId = message?.chat?.id
    ? String(message.chat.id)
    : callbackQuery?.message?.chat?.id
      ? String(callbackQuery.message.chat.id)
      : "";
  if (!chatId) return { ok: true, skipped: "no_chat" };

  const user = await userModel.findOne({ "telegram.chatId": chatId }).select("_id username displayName email telegram moduleAccess");

  if (!user?._id || !user.telegram?.isActive) {
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://vivutrade.io.vn").replace(/\/+$/, "");
    const linkUrl = siteUrl + "/vi/modules";
    if (message?.text) {
      await sendTelegramMessage({
        chatId,
        text: "Tài khoản Telegram này chưa được liên kết.\nLiên kết tại đây: " + linkUrl + "\nSau khi liên kết, quay lại bot và bấm /menu.",
        parseMode: "",
      });
    } else if (callbackQuery?.id) {
      await answerTelegramCallbackQuery({ callbackQueryId: callbackQuery.id, text: "Liên kết tài khoản tại: " + linkUrl, showAlert: true });
    }
    return { ok: true, skipped: "not_linked" };
  }

  if (!hasTelegramModuleAccess(user)) {
    await sendTelegramMessage({ chatId, text: "Tài khoản này chưa có module Telegram đang hoạt động trên web.", parseMode: "" });
    return { ok: true, skipped: "no_module" };
  }

  const setupState = await loadUserSetupState(user._id);

  if (callbackQuery?.data) {
    await handleCallback({
      user,
      state: setupState.state,
      chatId,
      messageId: callbackQuery?.message?.message_id,
      callbackQueryId: callbackQuery.id,
      data: callbackQuery.data,
    });
    return { ok: true };
  }

  const text = String(message?.text || "").trim();
  if (text === "/menu" || text === "/start" || text.toLowerCase() === "menu") {
    await sendMainMenu({ user, state: setupState.state, chatId, messageId: null });
    return { ok: true };
  }

  try {
    const handled = await handleTextIntent({ user, state: setupState.state, chatId, text });
    if (handled) return { ok: true };
  } catch (error) {
    logError("telegram.alert.create_failed", {
      user_id: String(user._id || ""),
      chat_id: String(chatId || ""),
      text,
      error: error?.message || error,
    });
    await sendTelegramMessage({ chatId, text: "Không xử lý được lệnh: " + String(error?.message || "unknown_error"), parseMode: "" });
    return { ok: true, warning: "text_intent_failed" };
  }

  await sendTelegramMessage({ chatId, text: "Chưa hiểu lệnh. Gửi /help để xem mẫu câu lệnh hoặc /menu để dùng giao diện nút.", parseMode: "" });
  return { ok: true };
}
