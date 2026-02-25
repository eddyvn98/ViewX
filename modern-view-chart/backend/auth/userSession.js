import { userModel } from "../model/user.js";
import { normalizeUserRole } from "./roles.js";
import { verifyAccessToken } from "./userJwt.js";

function normalizeSessionVersion(value) {
    const parsed = Number.parseInt(String(value ?? "1"), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function resolveUserAuthFromAccessToken(token) {
    const payload = verifyAccessToken(token);
    if (!payload?.sub) return null;

    const user = await userModel.findById(payload.sub).select("_id role sessionVersion");
    if (!user?._id) return null;

    const userSessionVersion = normalizeSessionVersion(user.sessionVersion);
    const tokenSessionVersion = normalizeSessionVersion(payload.sv);
    if (tokenSessionVersion !== userSessionVersion) return null;

    return {
        userId: String(user._id),
        role: normalizeUserRole(user.role),
        sessionVersion: userSessionVersion,
    };
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
