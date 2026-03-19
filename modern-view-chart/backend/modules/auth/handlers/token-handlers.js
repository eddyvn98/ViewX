import { rotateRefreshToken, verifyAccessToken, revokeRefreshToken } from "../../../auth/userJwt.js";
import { userModel } from "../../../model/user.js";
import { normalizeUserRole } from "../../../auth/roles.js";
import { logError } from "../../../logger.js";
import { clearRefreshCookie, getRefreshTokenFromRequest, setRefreshCookie } from "../cookie-utils.js";
import { toAuthResponse } from "../token-utils.js";

export async function refresh(req, res) {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) return res.status(401).json({ error: "refresh_token is required" });

    try {
        const tokens = await rotateRefreshToken(refreshToken);
        setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);

        const payload = verifyAccessToken(tokens.accessToken);
        const user = payload?.sub ? await userModel.findById(payload.sub) : null;
        if (user?._id) {
            const normalizedRole = normalizeUserRole(user.role);
            return res.status(200).json(toAuthResponse(user, tokens, normalizedRole));
        }

        return res.status(200).json({
            token_type: "Bearer",
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_at: tokens.accessExpiresAt,
        });
    } catch (error) {
        logError("auth.refresh.failed", { error: error?.message || error });
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

