import crypto from "crypto";
import jwt from "jsonwebtoken";

const activeRefreshJtis = new Map();

function nowEpochSeconds() {
    return Math.floor(Date.now() / 1000);
}

function getAccessSecret() {
    return (process.env.AUTH_ACCESS_JWT_SECRET || process.env.JWT || "").trim();
}

function getRefreshSecret() {
    return (process.env.AUTH_REFRESH_JWT_SECRET || process.env.JWT || "").trim();
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
    return { accessSecret, refreshSecret };
}

function toNumericDate(value) {
    if (typeof value === "number") return value;
    if (value instanceof Date) return Math.floor(value.getTime() / 1000);
    return nowEpochSeconds();
}

function purgeExpiredRefreshJtis() {
    const now = nowEpochSeconds();
    for (const [jti, exp] of activeRefreshJtis.entries()) {
        if (typeof exp !== "number" || exp <= now) activeRefreshJtis.delete(jti);
    }
}

function rememberRefreshJti(jti, exp) {
    purgeExpiredRefreshJtis();
    activeRefreshJtis.set(jti, toNumericDate(exp));
}

function revokeRefreshJti(jti) {
    if (!jti) return;
    activeRefreshJtis.delete(jti);
}

export function issueAuthTokens({ userId, role }) {
    const { accessSecret, refreshSecret } = requireSecrets();
    const subject = String(userId || "");
    const userRole = role || "user";
    const refreshJti = crypto.randomUUID();

    const accessToken = jwt.sign(
        {
            sub: subject,
            role: userRole,
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
            type: "refresh",
            jti: refreshJti,
        },
        refreshSecret,
        {
            expiresIn: getRefreshTtl(),
        },
    );

    const decodedRefresh = jwt.decode(refreshToken) || {};
    rememberRefreshJti(refreshJti, decodedRefresh.exp);

    const decodedAccess = jwt.decode(accessToken) || {};
    return {
        accessToken,
        refreshToken,
        accessExpiresAt: toNumericDate(decodedAccess.exp),
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

export function rotateRefreshToken(refreshToken) {
    const { refreshSecret } = requireSecrets();
    const payload = jwt.verify(refreshToken, refreshSecret);
    if (!payload || payload.type !== "refresh" || !payload.jti || !payload.sub) {
        throw new Error("Invalid refresh token");
    }
    if (!activeRefreshJtis.has(payload.jti)) {
        throw new Error("Refresh token revoked");
    }

    revokeRefreshJti(payload.jti);
    return issueAuthTokens({
        userId: payload.sub,
        role: payload.role || "user",
    });
}

export function revokeRefreshToken(refreshToken) {
    if (!refreshToken) return false;
    const refreshSecret = getRefreshSecret();
    if (!refreshSecret) return false;
    try {
        const payload = jwt.verify(refreshToken, refreshSecret);
        revokeRefreshJti(payload?.jti);
        return true;
    } catch {
        return false;
    }
}
