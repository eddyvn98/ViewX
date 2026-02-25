import { verifyAccessTicket } from "./accessTicket.js";

export function extractBearerCredential(authHeader) {
    if (!authHeader) return "";
    const [scheme, token] = String(authHeader).split(" ");
    if (!scheme || !token) return "";
    return scheme.toLowerCase() === "bearer" ? token.trim() : "";
}

export function isAuthorizedWithCredential({
    expectedToken,
    bearerCredential = "",
    queryAccessToken = "",
    queryAccessTicket = "",
}) {
    const secret = (expectedToken || "").trim();
    if (!secret) return false;

    if (queryAccessToken && queryAccessToken === secret) return true;
    if (bearerCredential && bearerCredential === secret) return true;

    if (queryAccessTicket && verifyAccessTicket(queryAccessTicket, secret)) return true;
    if (bearerCredential && verifyAccessTicket(bearerCredential, secret)) return true;

    return false;
}
