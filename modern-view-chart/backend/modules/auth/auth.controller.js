import CryptoJS from "crypto-js";
import Users from "../../model/user.js";
import {
    issueAuthTokens,
    revokeRefreshToken,
    rotateRefreshToken,
} from "../../auth/userJwt.js";

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

        const tokens = issueAuthTokens({
            userId: user._id,
            role: user.role,
        });
        setRefreshCookie(res, tokens.refreshToken);

        return res.status(200).json({
            token_type: "Bearer",
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_at: tokens.accessExpiresAt,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("[AUTH] login failed:", error?.message || error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function refresh(req, res) {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) return res.status(401).json({ error: "refresh_token is required" });

    try {
        const tokens = rotateRefreshToken(refreshToken);
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
