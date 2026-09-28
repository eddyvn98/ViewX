import CryptoJS from "crypto-js";
import { OAuth2Client } from "google-auth-library";
import Users from "../../../model/user.js";
import { userModel } from "../../../model/user.js";
import { issueAuthTokens } from "../../../auth/userJwt.js";
import { normalizeUserRole } from "../../../auth/roles.js";
import { resolveUserAccountTier } from "../../../auth/accountTier.js";
import { logError } from "../../../logger.js";
import { getGoogleClientId, parseJwtPayload, toAuthResponse } from "../token-utils.js";
import { setRefreshCookie } from "../cookie-utils.js";

const googleClient = new OAuth2Client();

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

        const sessionVersion = Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1;
        const normalizedRole = normalizeUserRole(user.role);
        const tokens = await issueAuthTokens({
            userId: user._id,
            role: normalizedRole,
            sessionVersion,
            accountTier: resolveUserAccountTier(user),
        });
        setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
        if (normalizedRole !== user.role) {
            await userModel.updateOne({ _id: user._id }, { $set: { role: normalizedRole } });
        }

        return res.status(200).json(toAuthResponse(user, tokens, normalizedRole));
    } catch (error) {
        logError("auth.login.failed", { error: error?.message || error });
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function googleLogin(req, res) {
    const clientId = getGoogleClientId();
    if (!clientId) {
        return res.status(503).json({ error: "Google login is not configured" });
    }

    const idToken = typeof req.body?.id_token === "string" ? req.body.id_token.trim() : "";
    if (!idToken) {
        return res.status(400).json({ error: "id_token is required" });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: clientId,
        });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
            return res.status(401).json({ error: "Invalid Google account payload" });
        }

        const email = String(payload.email).trim().toLowerCase();
        if (!email) {
            return res.status(401).json({ error: "Invalid Google account email" });
        }

        let user = await userModel.findOne({
            $or: [{ googleId: payload.sub }, { username: email }],
        });

        if (!user) {
            user = await userModel.create({
                username: email,
                authProvider: "google",
                googleId: payload.sub,
                displayName: typeof payload.name === "string" ? payload.name : "",
                avatarUrl: typeof payload.picture === "string" ? payload.picture : "",
                emailVerified: true,
                role: "viewer",
                sessionVersion: 1,
            });
        } else {
            const update = {};
            if (!user.googleId) update.googleId = payload.sub;
            if (user.authProvider !== "google") update.authProvider = "google";
            if (typeof payload.name === "string" && payload.name && user.displayName !== payload.name) {
                update.displayName = payload.name;
            }
            if (typeof payload.picture === "string" && payload.picture && user.avatarUrl !== payload.picture) {
                update.avatarUrl = payload.picture;
            }
            if (user.emailVerified !== true) update.emailVerified = true;

            if (Object.keys(update).length > 0) {
                await userModel.updateOne({ _id: user._id }, { $set: update });
                user = await userModel.findById(user._id);
            }
        }

        const sessionVersion = Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1;
        const normalizedRole = normalizeUserRole(user.role);
        const tokens = await issueAuthTokens({
            userId: user._id,
            role: normalizedRole,
            sessionVersion,
            accountTier: resolveUserAccountTier(user),
        });
        setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);

        if (normalizedRole !== user.role) {
            await userModel.updateOne({ _id: user._id }, { $set: { role: normalizedRole } });
            user.role = normalizedRole;
        }

        return res.status(200).json(toAuthResponse(user, tokens, normalizedRole));
    } catch (error) {
        const reason = error?.message || "Unknown Google verification error";
        const unverifiedPayload = parseJwtPayload(idToken);
        logError("auth.google_login.failed", {
            error: reason,
            expected_audience: clientId,
            token_audience: unverifiedPayload?.aud || null,
            token_issuer: unverifiedPayload?.iss || null,
        });

        const detailedError =
            process.env.NODE_ENV === "production" ? "Google login failed" : `Google login failed: ${reason}`;
        return res.status(401).json({ error: detailedError });
    }
}

