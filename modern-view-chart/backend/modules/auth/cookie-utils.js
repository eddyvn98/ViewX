export function getRefreshTokenFromRequest(req) {
    if (typeof req.body?.refresh_token === "string" && req.body.refresh_token.trim()) {
        return req.body.refresh_token.trim();
    }
    if (typeof req.cookies?.refresh_token === "string" && req.cookies.refresh_token.trim()) {
        return req.cookies.refresh_token.trim();
    }
    return "";
}

export function setRefreshCookie(res, refreshToken, refreshExpiresAt) {
    const expiresAtMs = Number.isFinite(Number(refreshExpiresAt)) ? Number(refreshExpiresAt) * 1000 : 0;
    const maxAgeMs = expiresAtMs > Date.now() ? expiresAtMs - Date.now() : undefined;
    res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth",
        maxAge: maxAgeMs,
    });
}

export function clearRefreshCookie(res) {
    res.clearCookie("refresh_token", {
        path: "/api/auth",
    });
}
