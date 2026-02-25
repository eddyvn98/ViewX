import { extractBearerCredential, isAuthorizedWithCredential } from "../auth/credential.js";
import { resolveUserAuthFromAccessToken } from "../auth/userSession.js";

export default async function requireAuth(req, res, next) {
    const bearerCredential = extractBearerCredential(req.headers.authorization);
    const userAuth = await resolveUserAuthFromAccessToken(bearerCredential);
    if (userAuth?.userId) {
        req.auth = {
            type: "user",
            userId: userAuth.userId,
            role: userAuth.role,
            sessionVersion: userAuth.sessionVersion,
            tokenType: "access",
        };
        return next();
    }

    const expected = (process.env.ACCESS_TOKEN || "").trim();
    const queryToken = typeof req.query.access_token === "string" ? req.query.access_token.trim() : "";
    const queryTicket = typeof req.query.access_ticket === "string" ? req.query.access_ticket.trim() : "";

    if (
        expected &&
        isAuthorizedWithCredential({
            expectedToken: expected,
            bearerCredential,
            queryAccessToken: queryToken,
            queryAccessTicket: queryTicket,
        })
    ) {
        req.auth = { type: "service" };
        return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
}
