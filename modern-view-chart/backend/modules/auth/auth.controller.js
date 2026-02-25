import CryptoJS from "crypto-js";
import Users from "../../model/user.js";
import { userModel } from "../../model/user.js";
import {
    issueAuthTokens,
    revokeRefreshToken,
    rotateRefreshToken,
} from "../../auth/userJwt.js";
import { normalizeUserRole } from "../../auth/roles.js";
import { revokeSessionsByUserId } from "../../auth/userSession.js";
import { logError, logInfo } from "../../logger.js";

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

        return res.status(200).json({
            token_type: "Bearer",
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_at: tokens.accessExpiresAt,
            user: {
                _id: user._id,
                username: user.username,
                role: normalizedRole,
            },
        });
    } catch (error) {
        logError("auth.login.failed", { error: error?.message || error });
        return res.status(500).json({ error: "Internal server error" });
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
