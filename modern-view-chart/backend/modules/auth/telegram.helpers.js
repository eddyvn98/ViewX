import { normalizeUserRole } from "../../auth/roles.js";

export function canManageTelegramWebhook(req) {
    if (req.auth?.type === "service") return true;
    if (req.auth?.type === "user" && normalizeUserRole(req.auth?.role) === "admin") return true;
    return false;
}

export function resolveTelegramWebhookUrl(req) {
    const fromBody = typeof req.body?.webhook_url === "string" ? req.body.webhook_url.trim() : "";
    if (fromBody) return fromBody;

    const fromEnv =
        String(process.env.TELEGRAM_WEBHOOK_URL || "").trim() ||
        String(process.env.APP_PUBLIC_URL || "").trim() ||
        String(process.env.PUBLIC_APP_URL || "").trim() ||
        String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
    if (!fromEnv) return "";

    try {
        const u = new URL(fromEnv);
        u.pathname = "/api/auth/telegram/webhook";
        u.search = "";
        u.hash = "";
        return u.toString();
    } catch {
        return "";
    }
}
