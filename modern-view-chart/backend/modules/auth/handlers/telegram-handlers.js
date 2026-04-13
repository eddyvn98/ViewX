import { logError } from "../../../logger.js";
import {
  getTelegramConfig,
  getTelegramWebhookInfo,
  setTelegramWebhook,
} from "../../../services/telegram.js";
import { enqueueTelegramWebhookUpdate } from "../../../services/telegramWebhookQueue.js";
import { canManageTelegramWebhook, resolveTelegramWebhookUrl } from "../telegram.helpers.js";

export async function telegramWebhook(req, res) {
  try {
    const { enabled } = getTelegramConfig();
    if (!enabled) return res.status(200).json({ ok: true, skipped: "telegram_disabled" });

    const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
    if (expectedSecret) {
      const actualSecret = String(req.headers["x-telegram-bot-api-secret-token"] || "").trim();
      if (actualSecret !== expectedSecret) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }

    const queued = await enqueueTelegramWebhookUpdate(req.body || {});
    if (!queued.accepted) {
      return res.status(200).json({ ok: true, skipped: queued.reason || "not_accepted" });
    }
    return res.status(200).json({
      ok: true,
      queued: true,
      duplicate: Boolean(queued.duplicate),
      update_id: queued.updateId ?? null,
    });
  } catch (error) {
    logError("auth.telegram_webhook.failed", { error: error?.message || error });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function setupTelegramWebhook(req, res) {
  try {
    if (!canManageTelegramWebhook(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { enabled } = getTelegramConfig();
    if (!enabled) {
      return res.status(400).json({ error: "Telegram bot is not configured" });
    }

    const webhookUrl = resolveTelegramWebhookUrl(req);
    if (!webhookUrl) {
      return res.status(400).json({
        error:
          "Missing webhook URL. Provide body.webhook_url or set TELEGRAM_WEBHOOK_URL / APP_PUBLIC_URL / NEXT_PUBLIC_APP_URL.",
      });
    }
    if (!/^https:\/\//i.test(webhookUrl)) {
      return res.status(400).json({ error: "Webhook URL must use https" });
    }

    const secretToken = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
    const dropPendingUpdates = Boolean(req.body?.drop_pending_updates === true);

    const setResult = await setTelegramWebhook({
      webhookUrl,
      secretToken,
      dropPendingUpdates,
    });
    if (!setResult.ok) {
      return res.status(502).json({ ok: false, error: setResult.error || "Failed to set Telegram webhook" });
    }

    const infoResult = await getTelegramWebhookInfo();
    return res.status(200).json({
      ok: true,
      webhook_url: webhookUrl,
      secret_enabled: Boolean(secretToken),
      set_result: setResult.data || null,
      webhook_info: infoResult.ok ? infoResult.data : null,
    });
  } catch (error) {
    logError("auth.telegram_webhook.setup_failed", { error: error?.message || error });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function inspectTelegramWebhook(req, res) {
  try {
    if (!canManageTelegramWebhook(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await getTelegramWebhookInfo();
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error || "Failed to get webhook info" });
    }
    return res.status(200).json({ ok: true, data: result.data });
  } catch (error) {
    logError("auth.telegram_webhook.inspect_failed", { error: error?.message || error });
    return res.status(500).json({ error: "Internal server error" });
  }
}
