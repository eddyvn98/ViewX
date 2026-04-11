import crypto from "crypto";

function env(name) {
  return String(process.env[name] || "").trim();
}

export function getTelegramConfig() {
  const botToken = env("TELEGRAM_BOT_TOKEN");
  const botUsername = env("TELEGRAM_BOT_USERNAME");
  const enabled = Boolean(botToken);
  return { botToken, botUsername, enabled };
}

export function buildTelegramStartPayload() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashTelegramPayload(raw) {
  return crypto.createHash("sha256").update(String(raw || ""), "utf8").digest("hex");
}

export function buildTelegramDeepLink({ botUsername, payload }) {
  if (!botUsername || !payload) return "";
  return `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`;
}

export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = "HTML",
  disableWebPagePreview = true,
  replyMarkup,
}) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: disableWebPagePreview,
    reply_markup: replyMarkup,
  };
  if (parseMode) payload.parse_mode = parseMode;
  return callTelegramApi("sendMessage", payload);
}

export async function sendTelegramPhoto({
  chatId,
  photo,
  caption = "",
  parseMode = "HTML",
  disableNotification = false,
  replyMarkup,
}) {
  const payload = {
    chat_id: chatId,
    photo,
    caption,
    disable_notification: Boolean(disableNotification),
    reply_markup: replyMarkup,
  };
  if (parseMode) payload.parse_mode = parseMode;
  return callTelegramApi("sendPhoto", payload);
}

export async function sendTelegramPhotoBuffer({
  chatId,
  filename,
  buffer,
  mimeType = "image/png",
  caption = "",
  parseMode = "",
  disableNotification = false,
}) {
  const { botToken, enabled } = getTelegramConfig();
  if (!enabled || !botToken) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is missing" };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const form = new FormData();
  form.append("chat_id", String(chatId || ""));
  form.append("disable_notification", disableNotification ? "true" : "false");
  if (caption) form.append("caption", caption);
  if (parseMode) form.append("parse_mode", parseMode);
  form.append("photo", new Blob([buffer], { type: mimeType }), filename || "snapshot.png");

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.description || `Telegram HTTP ${res.status}`,
      data,
    };
  }

  return { ok: true, status: res.status, data };
}

export async function sendTelegramDocument({
  chatId,
  document,
  caption = "",
  parseMode = "HTML",
  disableNotification = false,
  replyMarkup,
}) {
  const payload = {
    chat_id: chatId,
    document,
    caption,
    disable_notification: Boolean(disableNotification),
    reply_markup: replyMarkup,
  };
  if (parseMode) payload.parse_mode = parseMode;
  return callTelegramApi("sendDocument", payload);
}

export async function sendTelegramDocumentBuffer({
  chatId,
  filename,
  buffer,
  mimeType = "application/octet-stream",
  caption = "",
  parseMode = "",
  disableNotification = false,
}) {
  const { botToken, enabled } = getTelegramConfig();
  if (!enabled || !botToken) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is missing" };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
  const form = new FormData();
  form.append("chat_id", String(chatId || ""));
  form.append("disable_notification", disableNotification ? "true" : "false");
  if (caption) form.append("caption", caption);
  if (parseMode) form.append("parse_mode", parseMode);
  form.append("document", new Blob([buffer], { type: mimeType }), filename || "snapshot.bin");

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.description || `Telegram HTTP ${res.status}`,
      data,
    };
  }

  return { ok: true, status: res.status, data };
}

export async function editTelegramMessage({
  chatId,
  messageId,
  text,
  parseMode = "HTML",
  disableWebPagePreview = true,
  replyMarkup,
}) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: disableWebPagePreview,
    reply_markup: replyMarkup,
  };
  if (parseMode) payload.parse_mode = parseMode;
  return callTelegramApi("editMessageText", payload);
}

export async function answerTelegramCallbackQuery({ callbackQueryId, text = "", showAlert = false }) {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: Boolean(showAlert),
  });
}

export async function callTelegramApi(method, payload = {}) {
  const { botToken, enabled } = getTelegramConfig();
  if (!enabled || !botToken) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is missing" };
  }

  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.description || `Telegram HTTP ${res.status}`,
      data,
    };
  }

  return { ok: true, status: res.status, data };
}

export async function setTelegramWebhook({ webhookUrl, secretToken, dropPendingUpdates = false }) {
  const { botToken, enabled } = getTelegramConfig();
  if (!enabled || !botToken) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is missing" };
  }
  if (!webhookUrl) {
    return { ok: false, status: 0, error: "webhookUrl is required" };
  }

  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const payload = {
    url: webhookUrl,
    drop_pending_updates: Boolean(dropPendingUpdates),
  };
  if (secretToken) payload.secret_token = secretToken;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.description || `Telegram HTTP ${res.status}`,
      data,
    };
  }
  return { ok: true, status: res.status, data };
}

export async function getTelegramWebhookInfo() {
  const { botToken, enabled } = getTelegramConfig();
  if (!enabled || !botToken) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is missing" };
  }
  const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.description || `Telegram HTTP ${res.status}`,
      data,
    };
  }
  return { ok: true, status: res.status, data };
}
