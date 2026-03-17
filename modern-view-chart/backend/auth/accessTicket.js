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

export function createAccessTicket(secret, ttlSec = 300, type = "ws_auth") {
    const normalizedSecret = (secret || "").trim();
    if (!normalizedSecret) return "";

    const nowSec = Math.floor(Date.now() / 1000);
    const safeTtl = Math.max(30, Number.parseInt(String(ttlSec || "300"), 10) || 300);
    const payload = {
        typ: type,
        iat: nowSec,
        exp: nowSec + safeTtl,
        nonce: crypto.randomBytes(8).toString("hex"),
    };
    const payloadPart = encodeBase64Url(JSON.stringify(payload));
    const signature = crypto.createHmac("sha256", normalizedSecret).update(payloadPart).digest("base64url");
    return `${payloadPart}.${signature}`;
}

export function verifyAccessTicket(ticket, secret, nowMs = Date.now()) {
    if (!ticket || !secret) return false;
    const parts = String(ticket).split(".");
    if (parts.length !== 2) return false;

    const [payloadPart, signaturePart] = parts;
    if (!payloadPart || !signaturePart) return false;

    const expectedSignature = crypto.createHmac("sha256", secret).update(payloadPart).digest();
    const providedSignature = decodeBase64Url(signaturePart);
    if (providedSignature.length !== expectedSignature.length) return false;
    if (!crypto.timingSafeEqual(expectedSignature, providedSignature)) return false;

    try {
        const payloadRaw = decodeBase64Url(payloadPart).toString("utf-8");
        const payload = JSON.parse(payloadRaw);
        if (payload?.typ !== "ws_auth") return false;

        const exp = Number(payload?.exp);
        if (!Number.isFinite(exp)) return false;
        return nowMs < exp * 1000;
    } catch {
        return false;
    }
}
