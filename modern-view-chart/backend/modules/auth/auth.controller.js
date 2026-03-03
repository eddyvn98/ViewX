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

const googleClient = new OAuth2Client();

function getGoogleClientId() {
    return (process.env.GOOGLE_CLIENT_ID || "").trim();
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
        logError("auth.google_login.failed", { error: error?.message || error });
        return res.status(401).json({ error: "Google login failed" });
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
