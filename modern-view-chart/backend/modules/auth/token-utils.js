export function getGoogleClientId() {
    return (process.env.GOOGLE_CLIENT_ID || "").trim();
}

export function parseJwtPayload(token) {
    if (typeof token !== "string" || !token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    try {
        const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        const decoded = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function normalizeModuleKey(value) {
    return String(value || "").trim().toLowerCase();
}

function dedupeModules(values) {
    const out = [];
    for (const item of values) {
        const key = normalizeModuleKey(item);
        if (!key || out.includes(key)) continue;
        out.push(key);
    }
    return out;
}

function toDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function normalizeModuleAccess(user) {
    const now = Date.now();
    const rawAccess = Array.isArray(user?.moduleAccess) ? user.moduleAccess : [];
    const normalizedAccess = rawAccess.map((item) => ({
        ...item,
        module: normalizeModuleKey(item?.module),
    })).filter((item) => item.module);

    const existingModules = new Set(normalizedAccess.map((item) => item.module));
    const fallbackModules = dedupeModules([
        ...(Array.isArray(user?.modules) ? user.modules : []),
        ...(Array.isArray(user?.subscription?.modules) ? user.subscription.modules : []),
    ]);

    for (const moduleName of fallbackModules) {
        if (existingModules.has(moduleName)) continue;
        normalizedAccess.push({
            module: moduleName,
            trialStartedAt: null,
            trialEndsAt: null,
            activeUntil: moduleName === "your_mt5" || moduleName === "ai_assistant"
                ? toDate(user?.subscription?.validUntil) || new Date("2099-12-31T23:59:59.000Z")
                : toDate(user?.subscription?.validUntil),
            status: "active",
            source: "subscription_sync",
            lastOrderCode: "",
            updatedAt: new Date(),
        });
        existingModules.add(moduleName);
    }

    return normalizedAccess.map((item) => {
        const trialEndsAt = toDate(item?.trialEndsAt);
        const activeUntil = toDate(item?.activeUntil);
        const isActive = activeUntil ? activeUntil.getTime() > now : String(item?.status || "").toLowerCase() === "active";
        const isTrial = !isActive && trialEndsAt ? trialEndsAt.getTime() > now : String(item?.status || "").toLowerCase() === "trial";
        return {
            ...item,
            module: normalizeModuleKey(item?.module),
            status: isActive ? "active" : isTrial ? "trial" : "inactive",
            trialStartedAt: toDate(item?.trialStartedAt),
            trialEndsAt,
            activeUntil,
            source: String(item?.source || ""),
            lastOrderCode: String(item?.lastOrderCode || ""),
            updatedAt: toDate(item?.updatedAt),
        };
    });
}

export function toAuthResponse(user, tokens, normalizedRole) {
    const moduleAccess = normalizeModuleAccess(user);
    const modules = dedupeModules([
        ...(Array.isArray(user.modules) ? user.modules : []),
        ...(Array.isArray(user.subscription?.modules) ? user.subscription.modules : []),
        ...moduleAccess
            .filter((item) => item.status === "active" || item.status === "trial")
            .map((item) => item.module),
    ]);

    return {
        token_type: "Bearer",
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.accessExpiresAt,
        user: {
            _id: user._id,
            username: user.username,
            role: normalizedRole,
            auth_provider: user.authProvider || "local",
            display_name: user.displayName || "",
            avatar_url: user.avatarUrl || "",
            plan: user.plan || "free",
            modules,
            subscription: {
                ...(user.subscription || { plan: user.plan || "free", modules }),
                modules,
            },
            moduleAccess,
            mt5Consents: Array.isArray(user.mt5Consents) ? user.mt5Consents : [],
            aiAssistantCredits: Number(user.aiAssistantCredits || 0),
            aiAssistantCreditsUpdatedAt: user.aiAssistantCreditsUpdatedAt || null,
        },
    };
}
