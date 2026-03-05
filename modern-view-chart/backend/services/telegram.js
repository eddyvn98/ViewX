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

export async function sendTelegramMessage({ chatId, text, parseMode = "HTML", disableWebPagePreview = true }) {
  const { botToken, enabled } = getTelegramConfig();
  if (!enabled || !botToken) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is missing" };
  }
  if (!chatId) {
    return { ok: false, status: 0, error: "chat_id is required" };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: disableWebPagePreview,
    }),
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
