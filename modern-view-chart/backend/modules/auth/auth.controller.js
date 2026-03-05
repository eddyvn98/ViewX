import CryptoJS from "crypto-js";
import { OAuth2Client } from "google-auth-library";
import Users from "../../model/user.js";
import { userModel } from "../../model/user.js";
import {
    issueAuthTokens,
    revokeRefreshToken,
    rotateRefreshToken,
} from "../../auth/userJwt.js";
import { createAccessTicket } from "../../auth/accessTicket.js";
import { normalizeUserRole } from "../../auth/roles.js";
import { revokeSessionsByUserId } from "../../auth/userSession.js";
import { logError, logInfo } from "../../logger.js";
import {
    getTelegramConfig,
    getTelegramWebhookInfo,
    hashTelegramPayload,
    sendTelegramMessage,
    setTelegramWebhook,
} from "../../services/telegram.js";

const googleClient = new OAuth2Client();

function getGoogleClientId() {
    return (process.env.GOOGLE_CLIENT_ID || "").trim();
}

function parseJwtPayload(token) {
    if (typeof token !== "string" || !token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    try {
        const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        const decoded = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function toAuthResponse(user, tokens, normalizedRole) {
    return {
        token_type: "Bearer",
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.accessExpiresAt,
        user: {
            _id: user._id,
            username: user.username,
            role: normalizedRole,
            auth_provider: user.authProvider || "local",
            display_name: user.displayName || "",
            avatar_url: user.avatarUrl || "",
        },
    };
}

function getRefreshTokenFromRequest(req) {
    if (typeof req.body?.refresh_token === "string" && req.body.refresh_token.trim()) {
        return req.body.refresh_token.trim();
    }
    if (typeof req.cookies?.refresh_token === "string" && req.cookies.refresh_token.trim()) {
        return req.cookies.refresh_token.trim();
    }
    return "";
}

function setRefreshCookie(res, refreshToken) {
    res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth",
    });
}

function clearRefreshCookie(res) {
    res.clearCookie("refresh_token", {
        path: "/api/auth",
    });
}

export async function login(req, res) {
    const username = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const inputPassword = typeof req.body?.password === "string" ? req.body.password : "";
    if (!username || !inputPassword) {
        return res.status(400).json({ error: "email and password are required" });
    }

    try {
        const user = await Users.findOne({ username });
        if (!user?.password) return res.status(401).json({ error: "Invalid credentials" });

        const decrypted = CryptoJS.AES.decrypt(user.password, process.env.KEY_CRYPTO || "");
        const password = decrypted.toString(CryptoJS.enc.Utf8);
        if (!password || password !== inputPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const sessionVersion = Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1;
        const normalizedRole = normalizeUserRole(user.role);
        const tokens = issueAuthTokens({
            userId: user._id,
            role: normalizedRole,
            sessionVersion,
        });
        setRefreshCookie(res, tokens.refreshToken);
        if (normalizedRole !== user.role) {
            await userModel.updateOne({ _id: user._id }, { $set: { role: normalizedRole } });
        }

        return res.status(200).json(toAuthResponse(user, tokens, normalizedRole));
    } catch (error) {
        logError("auth.login.failed", { error: error?.message || error });
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function googleLogin(req, res) {
    const clientId = getGoogleClientId();
    if (!clientId) {
        return res.status(503).json({ error: "Google login is not configured" });
    }

    const idToken = typeof req.body?.id_token === "string" ? req.body.id_token.trim() : "";
    if (!idToken) {
        return res.status(400).json({ error: "id_token is required" });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: clientId,
        });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
            return res.status(401).json({ error: "Invalid Google account payload" });
        }

        const email = String(payload.email).trim().toLowerCase();
        if (!email) {
            return res.status(401).json({ error: "Invalid Google account email" });
        }

        let user = await userModel.findOne({
            $or: [{ googleId: payload.sub }, { username: email }],
        });

        if (!user) {
            user = await userModel.create({
                username: email,
                authProvider: "google",
                googleId: payload.sub,
                displayName: typeof payload.name === "string" ? payload.name : "",
                avatarUrl: typeof payload.picture === "string" ? payload.picture : "",
                emailVerified: true,
                role: "viewer",
                sessionVersion: 1,
            });
        } else {
            const update = {};
            if (!user.googleId) update.googleId = payload.sub;
            if (user.authProvider !== "google") update.authProvider = "google";
            if (typeof payload.name === "string" && payload.name && user.displayName !== payload.name) {
                update.displayName = payload.name;
            }
            if (typeof payload.picture === "string" && payload.picture && user.avatarUrl !== payload.picture) {
                update.avatarUrl = payload.picture;
            }
            if (user.emailVerified !== true) update.emailVerified = true;

            if (Object.keys(update).length > 0) {
                await userModel.updateOne({ _id: user._id }, { $set: update });
                user = await userModel.findById(user._id);
            }
        }

        const sessionVersion = Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1;
        const normalizedRole = normalizeUserRole(user.role);
        const tokens = issueAuthTokens({
            userId: user._id,
            role: normalizedRole,
            sessionVersion,
        });
        setRefreshCookie(res, tokens.refreshToken);

        if (normalizedRole !== user.role) {
            await userModel.updateOne({ _id: user._id }, { $set: { role: normalizedRole } });
            user.role = normalizedRole;
        }

        return res.status(200).json(toAuthResponse(user, tokens, normalizedRole));
    } catch (error) {
        const reason = error?.message || "Unknown Google verification error";
        const unverifiedPayload = parseJwtPayload(idToken);
        logError("auth.google_login.failed", {
            error: reason,
            expected_audience: clientId,
            token_audience: unverifiedPayload?.aud || null,
            token_issuer: unverifiedPayload?.iss || null,
        });

        const detailedError =
            process.env.NODE_ENV === "production" ? "Google login failed" : `Google login failed: ${reason}`;
        return res.status(401).json({ error: detailedError });
    }
}

export async function refresh(req, res) {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) return res.status(401).json({ error: "refresh_token is required" });

    try {
        const tokens = await rotateRefreshToken(refreshToken);
        setRefreshCookie(res, tokens.refreshToken);
        return res.status(200).json({
            token_type: "Bearer",
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_at: tokens.accessExpiresAt,
        });
    } catch (error) {
        clearRefreshCookie(res);
        return res.status(401).json({ error: "Invalid refresh token" });
    }
}

export async function logout(req, res) {
    const refreshToken = getRefreshTokenFromRequest(req);
    revokeRefreshToken(refreshToken);
    clearRefreshCookie(res);
    return res.status(200).json({ message: "Logged out" });
}

export async function revokeSessions(req, res) {
    if (req.auth?.type !== "user" || !req.auth?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const requestedUserId = typeof req.body?.user_id === "string" ? req.body.user_id.trim() : "";
    const targetUserId = requestedUserId || req.auth.userId;
    const isSelfRequest = targetUserId === req.auth.userId;
    const isAdmin = normalizeUserRole(req.auth.role) === "admin";
    if (!isSelfRequest && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
    }

    try {
        const revoked = await revokeSessionsByUserId(targetUserId);
        if (!revoked?.userId) return res.status(404).json({ error: "User not found" });

        // Also revoke current refresh token if provided in this call.
        const refreshToken = getRefreshTokenFromRequest(req);
        revokeRefreshToken(refreshToken);
        clearRefreshCookie(res);
        logInfo("auth.sessions.revoked", {
            actor_user_id: req.auth.userId,
            target_user_id: revoked.userId,
            session_version: revoked.sessionVersion,
        });
        return res.status(200).json({
            message: "Sessions revoked",
            user_id: revoked.userId,
            session_version: revoked.sessionVersion,
        });
    } catch (error) {
        logError("auth.sessions.revoke_failed", { error: error?.message || error });
        return res.status(500).json({ error: "Internal server error" });
    }
}

export function issueWsTicket(req, res) {
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });

    const secret = (process.env.ACCESS_TOKEN || "").trim();
    if (!secret) return res.status(503).json({ error: "Server access token is not configured" });

    const ttlSec = Number.parseInt(process.env.WS_AUTH_TICKET_TTL_SEC || "300", 10);
    const safeTtl = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : 300;
    const ticket = createAccessTicket(secret, safeTtl, "ws_auth");
    const expiresAt = Math.floor(Date.now() / 1000) + safeTtl;
    return res.status(200).json({
        token_type: "ticket",
        access_ticket: ticket,
        expires_at: expiresAt,
    });
}

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
            text: `✅ Connected to account <b>${String(user.username || "user")}</b>. You can now receive notifications.`,
        });

        return res.status(200).json({ ok: true, linked: true, user_id: String(user._id) });
    } catch (error) {
        logError("auth.telegram_webhook.failed", { error: error?.message || error });
        return res.status(500).json({ error: "Internal server error" });
    }
}

function canManageTelegramWebhook(req) {
    if (req.auth?.type === "service") return true;
    if (req.auth?.type === "user" && normalizeUserRole(req.auth?.role) === "admin") return true;
    return false;
}

function resolveTelegramWebhookUrl(req) {
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
