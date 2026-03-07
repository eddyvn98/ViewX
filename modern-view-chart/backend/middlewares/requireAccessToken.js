import { extractBearerCredential, isAuthorizedWithCredential } from "../auth/credential.js";

export default function requireAccessToken(req, res, next) {
    const expected = (process.env.ACCESS_TOKEN || "").trim();
    if (!expected) {
        return res.status(503).json({ error: "Server access token is not configured" });
    }

    const bearerCredential = extractBearerCredential(req.headers.authorization);

    const authorized = isAuthorizedWithCredential({
        expectedToken: expected,
        bearerCredential,
    });

    if (!authorized) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    return next();
}
