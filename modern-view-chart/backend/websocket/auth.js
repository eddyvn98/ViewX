import { extractBearerCredential, isAuthorizedWithCredential } from "../auth/credential.js";
import { readAccessTicket } from "../auth/accessTicket.js";
import {
    resolveUserAuthFromAccessToken,
    resolveUserAuthFromSessionClaims,
} from "../auth/userSession.js";
import { logWarn } from "../logger.js";

export function emitWsError(ws, payload) {
    ws.send(JSON.stringify({ topic: "error", ...payload }));
}

async function resolveCredentialContext(credential, expectedToken, via) {
    if (!credential) return null;

    const userAuth = await resolveUserAuthFromAccessToken(credential);
    if (userAuth?.userId) {
        return {
            type: "user",
            userId: userAuth.userId,
            role: userAuth.role,
            accountTier: userAuth.accountTier,
            via,
        };
    }

    const ticketPayload = expectedToken ? readAccessTicket(credential, expectedToken) : null;
    if (ticketPayload?.auth_type === "user" && ticketPayload?.sub) {
        const ticketUserAuth = await resolveUserAuthFromSessionClaims({
            userId: ticketPayload.sub,
            sessionVersion: ticketPayload.sv,
        });
        if (!ticketUserAuth?.userId) return null;
        return {
            type: "user",
            userId: ticketUserAuth.userId,
            role: ticketUserAuth.role,
            accountTier: ticketUserAuth.accountTier,
            via,
        };
    }

    if (
        expectedToken &&
        isAuthorizedWithCredential({
            expectedToken,
            bearerCredential: credential,
        })
    ) {
        return { type: "service", via };
    }

    return null;
}

export async function resolveAuthContext(request, queryAuthPolicy) {
    const expectedToken = (process.env.ACCESS_TOKEN || "").trim();

    const bearerCredential = extractBearerCredential(request.headers?.authorization || "");
    const bearerContext = await resolveCredentialContext(
        bearerCredential,
        expectedToken,
        "authorization_header",
    );
    if (bearerContext) return bearerContext;

    const protocolHeader = request.headers?.["sec-websocket-protocol"] || "";
    const protocolTokens = String(protocolHeader)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    for (const protocolToken of protocolTokens) {
        if (!protocolToken.startsWith("bearer.")) continue;
        const protocolValue = protocolToken.slice("bearer.".length);
        const protocolContext = await resolveCredentialContext(
            protocolValue,
            expectedToken,
            "sec_websocket_protocol",
        );
        if (protocolContext) return protocolContext;
    }

    const parsed = new URL(request.url || "/", "http://localhost");
    if (parsed.searchParams.has("access_token") || parsed.searchParams.has("access_ticket")) {
        logWarn("auth.ws.query_rejected", {
            reason: queryAuthPolicy.allowQueryAuth ? "sunset_expired" : "query_auth_disabled",
            has_access_token: parsed.searchParams.has("access_token"),
            has_access_ticket: parsed.searchParams.has("access_ticket"),
        });
    }

    return {
        type: "guest",
        role: "viewer",
        accountTier: "free",
        via: "anonymous",
    };
}
