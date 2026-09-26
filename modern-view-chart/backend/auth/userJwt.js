import crypto from "crypto";
import jwt from "jsonwebtoken";
import { normalizeUserRole } from "./roles.js";
import { userModel } from "../model/user.js";
import { refreshTokenModel } from "../model/refreshToken.js";

const memoryFallbackJtis = new Map();
let warnedJwtFallback = false;

function getAccessTokenFallbackSecret() {
    return (process.env.ACCESS_TOKEN || "").trim();
}

function getRefreshFallbackFromAccessToken(accessFallbackSecret) {
    if (!accessFallbackSecret) return "";
    return `${accessFallbackSecret}:refresh`;
}

function nowEpochSeconds() {
    return Math.floor(Date.now() / 1000);
}

function getAccessSecret() {
    const explicit = (process.env.AUTH_ACCESS_JWT_SECRET || process.env.JWT || "").trim();
    if (explicit) return explicit;
    return getAccessTokenFallbackSecret();
}

function getRefreshSecret() {
    const explicit = (process.env.AUTH_REFRESH_JWT_SECRET || process.env.JWT || "").trim();
    if (explicit) return explicit;
    return getRefreshFallbackFromAccessToken(getAccessTokenFallbackSecret());
}

function getAccessTtl() {
    return (process.env.AUTH_ACCESS_TTL || "1h").trim();
}

function getRefreshTtl() {
    return (process.env.AUTH_REFRESH_TTL || "7d").trim();
}

function requireSecrets() {
    const accessSecret = getAccessSecret();
    const refreshSecret = getRefreshSecret();
    if (!accessSecret || !refreshSecret) {
        throw new Error("JWT secrets are not configured");
    }
    if (!warnedJwtFallback) {
        const hasExplicitJwt = Boolean(
            (process.env.AUTH_ACCESS_JWT_SECRET || "").trim() ||
                (process.env.AUTH_REFRESH_JWT_SECRET || "").trim() ||
                (process.env.JWT || "").trim(),
        );
        if (!hasExplicitJwt) {
            warnedJwtFallback = true;
            console.warn(
                "[auth] AUTH_ACCESS_JWT_SECRET/AUTH_REFRESH_JWT_SECRET (or JWT) is missing. Falling back to ACCESS_TOKEN-derived secrets.",
            );
        }
    }
    return { accessSecret, refreshSecret };
}

function toNumericDate(value) {
    if (typeof value === "number") return value;
    if (value instanceof Date) return Math.floor(value.getTime() / 1000);
    return nowEpochSeconds();
}

export async function issueAuthTokens({ userId, role, sessionVersion = 1 }) {
    const { accessSecret, refreshSecret } = requireSecrets();
    const subject = String(userId || "");
    const userRole = normalizeUserRole(role);
    const userSessionVersion = Number.isFinite(Number(sessionVersion)) ? Number(sessionVersion) : 1;
    const refreshJti = crypto.randomUUID();

    const accessToken = jwt.sign(
        {
            sub: subject,
            role: userRole,
            sv: userSessionVersion,
            type: "access",
        },
        accessSecret,
        {
            expiresIn: getAccessTtl(),
        },
    );

    const refreshToken = jwt.sign(
        {
            sub: subject,
            role: userRole,
            sv: userSessionVersion,
            type: "refresh",
            jti: refreshJti,
        },
        refreshSecret,
        {
            expiresIn: getRefreshTtl(),
        },
    );

    const decodedRefresh = jwt.decode(refreshToken) || {};
    const decodedAccess = jwt.decode(accessToken) || {};
    const refreshExpiresAtSec = toNumericDate(decodedRefresh.exp);
    const accessExpiresAtSec = toNumericDate(decodedAccess.exp);

    try {
        await refreshTokenModel.create({
            jti: refreshJti,
            userId,
            expiresAt: new Date(refreshExpiresAtSec * 1000),
        });
    } catch (dbErr) {
        // In case DB write is temporarily slow or unavailable, keep in-memory fallback
        memoryFallbackJtis.set(refreshJti, refreshExpiresAtSec);
        if (dbErr?.name?.includes("Mongo")) {
            console.warn("[auth] Failed to persist refresh token to MongoDB, using memory fallback:", dbErr.message);
        } else {
            throw dbErr;
        }
    }

    return {
        accessToken,
        refreshToken,
        accessExpiresAt: accessExpiresAtSec,
        refreshExpiresAt: refreshExpiresAtSec,
    };
}

export function verifyAccessToken(token) {
    if (!token) return null;
    const secret = getAccessSecret();
    if (!secret) return null;
    try {
        const payload = jwt.verify(token, secret);
        if (payload?.type && payload.type !== "access") return null;
        return payload;
    } catch {
        return null;
    }
}

export async function rotateRefreshToken(refreshToken) {
    const { refreshSecret } = requireSecrets();
    const payload = jwt.verify(refreshToken, refreshSecret);
    if (!payload || payload.type !== "refresh" || !payload.jti || !payload.sub) {
        throw new Error("Invalid refresh token");
    }

    let tokenDoc = null;
    try {
        tokenDoc = await refreshTokenModel.findOne({ jti: payload.jti });
    } catch (dbErr) {
        const err = new Error(`Database error verifying refresh token: ${dbErr?.message || dbErr}`);
        err.isDatabaseError = true;
        throw err;
    }

    if (!tokenDoc) {
        // Check in-memory fallback
        if (!memoryFallbackJtis.has(payload.jti)) {
            throw new Error("Refresh token revoked");
        }
        memoryFallbackJtis.delete(payload.jti);
    } else if (tokenDoc.revokedAt) {
        const now = Date.now();
        const graceUntil = tokenDoc.gracePeriodUntil ? new Date(tokenDoc.gracePeriodUntil).getTime() : 0;
        if (now < graceUntil) {
            // Concurrent tab refresh within grace period: issue a fresh valid token pair for this tab
            const user = await userModel.findById(payload.sub).select("_id role sessionVersion");
            if (!user?._id) throw new Error("User not found");
            const currentSessionVersion = Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1;
            const tokenSessionVersion = Number.isFinite(Number(payload.sv)) ? Number(payload.sv) : 1;
            if (currentSessionVersion !== tokenSessionVersion) throw new Error("Session revoked");

            return issueAuthTokens({
                userId: user._id,
                role: normalizeUserRole(user.role),
                sessionVersion: currentSessionVersion,
            });
        }
        throw new Error("Refresh token revoked");
    }

    const user = await userModel.findById(payload.sub).select("_id role sessionVersion");
    if (!user?._id) {
        throw new Error("User not found");
    }
    const currentSessionVersion = Number.isFinite(Number(user.sessionVersion))
        ? Number(user.sessionVersion)
        : 1;
    const tokenSessionVersion = Number.isFinite(Number(payload.sv)) ? Number(payload.sv) : 1;
    if (currentSessionVersion !== tokenSessionVersion) {
        throw new Error("Session revoked");
    }

    // Mark previous refresh token as revoked with 30-second grace period for concurrent multi-tab requests
    if (tokenDoc) {
        tokenDoc.revokedAt = new Date();
        tokenDoc.gracePeriodUntil = new Date(Date.now() + 30000);
        try {
            await tokenDoc.save();
        } catch (saveErr) {
            console.warn("[auth] Failed to mark refresh token revoked:", saveErr?.message);
        }
    }

    return issueAuthTokens({
        userId: user._id,
        role: normalizeUserRole(user.role),
        sessionVersion: currentSessionVersion,
    });
}

export async function revokeRefreshToken(refreshToken) {
    if (!refreshToken) return false;
    const refreshSecret = getRefreshSecret();
    if (!refreshSecret) return false;
    try {
        const payload = jwt.verify(refreshToken, refreshSecret);
        if (payload?.jti) {
            memoryFallbackJtis.delete(payload.jti);
            await refreshTokenModel.updateOne(
                { jti: payload.jti },
                { $set: { revokedAt: new Date(), gracePeriodUntil: null } }
            );
        }
        return true;
    } catch {
        return false;
    }
}

export async function getActiveRefreshTokenCount() {
    try {
        return await refreshTokenModel.countDocuments({
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        });
    } catch {
        return memoryFallbackJtis.size;
    }
}
