import { userModel } from "../model/user.js";
import { normalizeUserRole } from "./roles.js";
import { verifyAccessToken } from "./userJwt.js";
import { resolveUserAccountTier } from "./accountTier.js";

function normalizeSessionVersion(value) {
    const parsed = Number.parseInt(String(value ?? "1"), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function resolveCurrentUserAuth(userId, sessionVersion) {
    const user = await userModel
        .findById(userId)
        .select("_id role sessionVersion plan subscription");
    if (!user?._id) return null;

    const userSessionVersion = normalizeSessionVersion(user.sessionVersion);
    const tokenSessionVersion = normalizeSessionVersion(sessionVersion);
    if (tokenSessionVersion !== userSessionVersion) return null;

    return {
        userId: String(user._id),
        role: normalizeUserRole(user.role),
        sessionVersion: userSessionVersion,
        accountTier: resolveUserAccountTier(user),
    };
}

export async function resolveUserAuthFromAccessToken(token) {
    const payload = verifyAccessToken(token);
    if (!payload?.sub) return null;
    return resolveCurrentUserAuth(payload.sub, payload.sv);
}

export async function resolveUserAuthFromSessionClaims({ userId, sessionVersion }) {
    if (!userId) return null;
    return resolveCurrentUserAuth(userId, sessionVersion);
}

export async function revokeSessionsByUserId(userId) {
    const user = await userModel.findById(userId).select("_id sessionVersion");
    if (!user?._id) return null;
    const nextVersion = normalizeSessionVersion(user.sessionVersion) + 1;
    user.sessionVersion = nextVersion;
    await user.save();
    return {
        userId: String(user._id),
        sessionVersion: nextVersion,
    };
}
