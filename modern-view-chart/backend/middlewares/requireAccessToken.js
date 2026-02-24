function extractBearerToken(authHeader) {
    if (!authHeader) return "";
    const [scheme, token] = authHeader.split(" ");
    if (!scheme || !token) return "";
    return scheme.toLowerCase() === "bearer" ? token.trim() : "";
}

export default function requireAccessToken(req, res, next) {
    const expected = (process.env.ACCESS_TOKEN || "").trim();
    if (!expected) {
        return res.status(503).json({ error: "Server access token is not configured" });
    }

    const queryToken = typeof req.query.access_token === "string" ? req.query.access_token.trim() : "";
    const bearerToken = extractBearerToken(req.headers.authorization);
    const provided = queryToken || bearerToken;

    if (!provided || provided !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    return next();
}
