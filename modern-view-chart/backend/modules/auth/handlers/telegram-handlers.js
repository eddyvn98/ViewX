import { logError } from "../../../logger.js";
import { getTelegramConfig, getTelegramWebhookInfo, hashTelegramPayload, sendTelegramMessage, setTelegramWebhook } from "../../../services/telegram.js";
import { userModel } from "../../../model/user.js";
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

        const message = req.body?.message;
        const text = typeof message?.text === "string" ? message.text.trim() : "";
        const chatId = message?.chat?.id ? String(message.chat.id) : "";
        const fromUser = message?.from || null;
        if (!text || !chatId) return res.status(200).json({ ok: true, skipped: "no_message" });

        if (!text.startsWith("/start")) {
            return res.status(200).json({ ok: true, skipped: "not_start_command" });
        }

        const payload = text.split(/\s+/, 2)[1] || "";
        if (!payload) {
            await sendTelegramMessage({
                chatId,
                text: "Please open Telegram from the app link to connect your account.",
                parseMode: "",
            });
            return res.status(200).json({ ok: true, linked: false, reason: "missing_payload" });
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
                text: "Link token is invalid or expired. Please reconnect from the app.",
                parseMode: "",
            });
            return res.status(200).json({ ok: true, linked: false, reason: "token_invalid_or_expired" });
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
            text: `? Connected to account <b>${String(user.username || "user")}</b>. You can now receive notifications.`,
        });

        return res.status(200).json({ ok: true, linked: true, user_id: String(user._id) });
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

