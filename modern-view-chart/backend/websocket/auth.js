import { extractBearerCredential, isAuthorizedWithCredential } from "../auth/credential.js";
import { resolveUserAuthFromAccessToken } from "../auth/userSession.js";
import { logWarn } from "../logger.js";

export function emitWsError(ws, payload) {
    ws.send(JSON.stringify({ topic: "error", ...payload }));
}

export async function resolveAuthContext(request, queryAuthPolicy) {
    const expectedToken = (process.env.ACCESS_TOKEN || "").trim();

    const bearerCredential = extractBearerCredential(request.headers?.authorization || "");
    const bearerUserAuth = await resolveUserAuthFromAccessToken(bearerCredential);
    if (bearerUserAuth?.userId) {
        return {
            type: "user",
            userId: bearerUserAuth.userId,
            role: bearerUserAuth.role,
            plan: bearerUserAuth.plan || "free",
            modules: bearerUserAuth.modules || [],
            subscription: bearerUserAuth.subscription || null,
            moduleAccess: bearerUserAuth.moduleAccess || [],
            via: "authorization_header",
        };
    }

    const protocolHeader = request.headers?.["sec-websocket-protocol"] || "";
    const protocolTokens = String(protocolHeader)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    const protocolBearerCredentials = [];
    for (const protocolToken of protocolTokens) {
        if (protocolToken.startsWith("bearer.")) {
            const protocolValue = protocolToken.slice("bearer.".length);
            protocolBearerCredentials.push(protocolValue);
            const protocolUserAuth = await resolveUserAuthFromAccessToken(protocolValue);
            if (protocolUserAuth?.userId) {
                return {
                    type: "user",
                    userId: protocolUserAuth.userId,
                    role: protocolUserAuth.role,
                    plan: protocolUserAuth.plan || "free",
                    modules: protocolUserAuth.modules || [],
                    subscription: protocolUserAuth.subscription || null,
                    moduleAccess: protocolUserAuth.moduleAccess || [],
                    via: "sec_websocket_protocol",
                };
            }
        }
    }

    if (!expectedToken) return null;

    if (
        isAuthorizedWithCredential({
            expectedToken,
            bearerCredential,
        })
    ) {
        return { type: "service", via: "authorization_header" };
    }

    for (const credential of protocolBearerCredentials) {
        if (
            isAuthorizedWithCredential({
                expectedToken,
                bearerCredential: credential,
            })
        ) {
            return { type: "service", via: "sec_websocket_protocol" };
        }
    }

    const parsed = new URL(request.url || "/", "http://localhost");
    if (parsed.searchParams.has("access_token") || parsed.searchParams.has("access_ticket")) {
        logWarn("auth.ws.query_rejected", {
            reason: queryAuthPolicy.allowQueryAuth ? "sunset_expired" : "query_auth_disabled",
            has_access_token: parsed.searchParams.has("access_token"),
            has_access_ticket: parsed.searchParams.has("access_ticket"),
        });
    }

    return { type: "guest", role: "viewer", via: "anonymous" };
}
