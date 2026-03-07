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
}) {
    const secret = (expectedToken || "").trim();
    if (!secret) return false;

    if (bearerCredential && bearerCredential === secret) return true;

    if (bearerCredential && verifyAccessTicket(bearerCredential, secret)) return true;

    return false;
}
