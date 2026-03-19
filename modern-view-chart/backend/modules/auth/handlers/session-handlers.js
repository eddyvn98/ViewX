import { revokeSessionsByUserId } from "../../../auth/userSession.js";
import { normalizeUserRole } from "../../../auth/roles.js";
import { logError, logInfo } from "../../../logger.js";
import { clearRefreshCookie, getRefreshTokenFromRequest } from "../cookie-utils.js";
import { revokeRefreshToken } from "../../../auth/userJwt.js";

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


