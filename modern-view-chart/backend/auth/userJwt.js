import crypto from "crypto";
import jwt from "jsonwebtoken";
import { normalizeUserRole } from "./roles.js";
import { userModel } from "../model/user.js";

let warnedJwtFallback = false;

function getAccessTokenFallbackSecret() {
    return (process.env.ACCESS_TOKEN || "").trim();
}

function getRefreshFallbackFromAccessToken(accessFallbackSecret) {
    if (!accessFallbackSecret) return "";
    return `${accessFallbackSecret}:refresh`;
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
    return (process.env.AUTH_ACCESS_TTL || "15m").trim();
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
    return Math.floor(Date.now() / 1000);
}

export function issueAuthTokens({ userId, role, sessionVersion = 1 }) {
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
    return {
        accessToken,
        refreshToken,
        accessExpiresAt: toNumericDate(decodedAccess.exp),
        refreshExpiresAt: toNumericDate(decodedRefresh.exp),
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

    return issueAuthTokens({
        userId: user._id,
        role: normalizeUserRole(user.role),
        sessionVersion: currentSessionVersion,
    });
}

export function revokeRefreshToken(refreshToken) {
    return Boolean(refreshToken);
}

export function getActiveRefreshTokenCount() {
    return 0;
}
