import crypto from "crypto";

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    const withPad = pad === 0 ? normalized : `${normalized}${"=".repeat(4 - pad)}`;
    return Buffer.from(withPad, "base64");
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
        if (payload?.typ !== "mobile_access") return false;

        const exp = Number(payload?.exp);
        if (!Number.isFinite(exp)) return false;
        return nowMs < exp * 1000;
    } catch {
        return false;
    }
}
