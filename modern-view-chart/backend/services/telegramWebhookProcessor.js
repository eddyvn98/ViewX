import { userModel } from "../model/user.js";
import { handleTelegramBotUpdate } from "./telegramBot.js";
import { hashTelegramPayload, sendTelegramMessage } from "./telegram.js";

export async function processTelegramWebhookUpdate(update) {
  const message = update?.message;
  const callbackQuery = update?.callback_query;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const chatId = message?.chat?.id ? String(message.chat.id) : "";
  const fromUser = message?.from || null;

  if (callbackQuery?.data) {
    await handleTelegramBotUpdate({ callbackQuery });
    return { ok: true, callback: true };
  }

  if (!text || !chatId) return { ok: true, skipped: "no_message" };

  if (!text.startsWith("/start")) {
    await handleTelegramBotUpdate({ message });
    return { ok: true, message: true };
  }

  const payload = text.split(/\s+/, 2)[1] || "";
  if (!payload) {
    const linkedUser = await userModel.findOne({ "telegram.chatId": chatId }).select("_id telegram");
    if (linkedUser?._id && linkedUser.telegram?.isActive) {
      await handleTelegramBotUpdate({ message });
      return { ok: true, menu: true };
    }

    await sendTelegramMessage({
      chatId,
      text: "Hãy mở Telegram từ liên kết trong web để liên kết tài khoản.",
      parseMode: "",
    });
    return { ok: true, linked: false, reason: "missing_payload" };
  }

  const payloadHash = hashTelegramPayload(payload);
  const now = new Date();
  const user = await userModel.findOne({
    "telegram.pendingLinkTokenHash": payloadHash,
    "telegram.pendingLinkExpiresAt": { $gt: now },
  });

  if (!user?._id) {
    await sendTelegramMessage({
      chatId,
      text: "Mã liên kết không hợp lệ hoặc đã hết hạn. Hãy tạo lại liên kết từ web.",
      parseMode: "",
    });
    return { ok: true, linked: false, reason: "token_invalid_or_expired" };
  }

  const tgUsername = typeof fromUser?.username === "string" ? fromUser.username : "";
  const tgFirstName = typeof fromUser?.first_name === "string" ? fromUser.first_name : "";
  const tgUserId = fromUser?.id ? String(fromUser.id) : "";

  user.telegram = {
    ...(user.telegram || {}),
    chatId,
    telegramUserId: tgUserId,
    username: tgUsername,
    firstName: tgFirstName,
    linkedAt: now,
    isActive: true,
    pendingLinkTokenHash: "",
    pendingLinkExpiresAt: null,
    preferences: {
      signals: user.telegram?.preferences?.signals !== false,
      orderEvents: user.telegram?.preferences?.orderEvents !== false,
      alertHits: user.telegram?.preferences?.alertHits !== false,
      system: user.telegram?.preferences?.system === true,
    },
  };
  await user.save();

  await sendTelegramMessage({
    chatId,
    text: `Đã liên kết với tài khoản <b>${String(user.username || "user")}</b>. Bạn có thể dùng /menu để mở bot menu.`,
  });

  await handleTelegramBotUpdate({
    message: {
      chat: { id: chatId },
      text: "/menu",
    },
  });

  return { ok: true, linked: true, user_id: String(user._id) };
}
