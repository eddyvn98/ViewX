import { resolveUserEntitlements } from "../../auth/modules.js";

export function getGoogleClientId() {
    return (process.env.GOOGLE_CLIENT_ID || "").trim();
}

export function parseJwtPayload(token) {
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

export function toAuthResponse(user, tokens, normalizedRole) {
    const ent = resolveUserEntitlements(user);
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
            plan: ent.plan,
            modules: ent.modules,
            subscription: {
                plan: ent.plan,
                modules: ent.modules,
                validUntil: ent.validUntil,
            },
        },
    };
}
