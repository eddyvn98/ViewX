export const WS_CLIENT_MODES = Object.freeze({
    WEB_FREE: "web_free",
    WEB_PRO: "web_pro",
    PRO_EXTENSION: "pro_extension",
    SERVICE_BRIDGE: "service_bridge",
});

export function getDefaultClientMode(authContext) {
    if (authContext?.type === "service") return WS_CLIENT_MODES.SERVICE_BRIDGE;
    if (authContext?.type === "user" && authContext?.accountTier === "pro") return WS_CLIENT_MODES.WEB_PRO;
    return WS_CLIENT_MODES.WEB_FREE;
}

export function resolveRequestedClientMode(requestedMode, meta) {
    const requested = String(requestedMode || "").trim().toLowerCase();
    if (!requested) return meta?.clientMode || getDefaultClientMode(meta);

    if (requested === WS_CLIENT_MODES.SERVICE_BRIDGE) {
        return meta?.authType === "service" ? requested : null;
    }
    if (requested === WS_CLIENT_MODES.PRO_EXTENSION) {
        return meta?.authType === "user" && meta?.accountTier === "pro" ? requested : null;
    }
    if (requested === WS_CLIENT_MODES.WEB_PRO) {
        return meta?.authType === "user" && meta?.accountTier === "pro" ? requested : null;
    }
    if (requested === WS_CLIENT_MODES.WEB_FREE) {
        return meta?.authType === "guest" || meta?.authType === "user" ? requested : null;
    }

    return null;
}

export function isBridgeClientMode(mode) {
    return mode === WS_CLIENT_MODES.SERVICE_BRIDGE || mode === WS_CLIENT_MODES.PRO_EXTENSION;
}
