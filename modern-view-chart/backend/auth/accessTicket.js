import crypto from "crypto";

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    const withPad = pad === 0 ? normalized : `${normalized}${"=".repeat(4 - pad)}`;
    return Buffer.from(withPad, "base64");
}

function encodeBase64Url(value) {
    return Buffer.from(value).toString("base64url");
}

export function createAccessTicket(secret, ttlSec = 300, type = "ws_auth", claims = {}) {
    const normalizedSecret = (secret || "").trim();
    if (!normalizedSecret) return "";

    const nowSec = Math.floor(Date.now() / 1000);
    const safeTtl = Math.max(30, Number.parseInt(String(ttlSec || "300"), 10) || 300);
    const safeClaims = claims && typeof claims === "object" ? claims : {};
    const payload = {
        ...safeClaims,
        typ: type,
        iat: nowSec,
        exp: nowSec + safeTtl,
        nonce: crypto.randomBytes(8).toString("hex"),
    };
    const payloadPart = encodeBase64Url(JSON.stringify(payload));
    const signature = crypto.createHmac("sha256", normalizedSecret).update(payloadPart).digest("base64url");
    return `${payloadPart}.${signature}`;
}

export function readAccessTicket(ticket, secret, nowMs = Date.now()) {
    if (!ticket || !secret) return null;
    const parts = String(ticket).split(".");
    if (parts.length !== 2) return null;

    const [payloadPart, signaturePart] = parts;
    if (!payloadPart || !signaturePart) return null;

    const expectedSignature = crypto.createHmac("sha256", secret).update(payloadPart).digest();
    const providedSignature = decodeBase64Url(signaturePart);
    if (providedSignature.length !== expectedSignature.length) return null;
    if (!crypto.timingSafeEqual(expectedSignature, providedSignature)) return null;

    try {
        const payloadRaw = decodeBase64Url(payloadPart).toString("utf-8");
        const payload = JSON.parse(payloadRaw);
        if (payload?.typ !== "ws_auth") return null;

        const exp = Number(payload?.exp);
        if (!Number.isFinite(exp)) return null;
        if (nowMs >= exp * 1000) return null;
        return payload;
    } catch {
        return null;
    }
}

export function verifyAccessTicket(ticket, secret, nowMs = Date.now()) {
    return Boolean(readAccessTicket(ticket, secret, nowMs));
}
