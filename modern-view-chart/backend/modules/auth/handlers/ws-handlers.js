import { createAccessTicket } from "../../../auth/accessTicket.js";

export function issueWsTicket(req, res) {
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });

    const secret = (process.env.ACCESS_TOKEN || "").trim();
    if (!secret) return res.status(503).json({ error: "Server access token is not configured" });

    const ttlSec = Number.parseInt(process.env.WS_AUTH_TICKET_TTL_SEC || "300", 10);
    const safeTtl = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : 300;
    const ticket = createAccessTicket(secret, safeTtl, "ws_auth");
    const expiresAt = Math.floor(Date.now() / 1000) + safeTtl;
    return res.status(200).json({
        token_type: "ticket",
        access_ticket: ticket,
        expires_at: expiresAt,
    });
}

