export const ENTITLEMENT_MODULES = new Set([
    "mt5_trade",
    "binance_trade",
    "telegram_notify",
    "telegram_control",
    "ai_assistant",
]);

export function normalizeEntitlementModules(raw) {
    if (!Array.isArray(raw)) return [];
    const output = [];
    for (const item of raw) {
        const key = String(item || "").trim().toLowerCase();
        if (!key || !ENTITLEMENT_MODULES.has(key) || output.includes(key)) continue;
        output.push(key);
    }
    return output;
}

export function inferPlanFromModules(modules = []) {
    const normalized = normalizeEntitlementModules(modules);
    if (normalized.includes("ai_assistant")) return "pro_plus";
    if (normalized.length > 0) return "pro";
    return "free";
}

export function inferModulesFromPlan(plan) {
    const normalized = String(plan || "").trim().toLowerCase();
    if (normalized === "pro_plus" || normalized === "premium" || normalized === "pro+") {
        return ["mt5_trade", "binance_trade", "telegram_notify", "telegram_control", "ai_assistant"];
    }
    if (normalized === "pro" || normalized.startsWith("pro")) {
        return ["mt5_trade", "binance_trade", "telegram_notify", "telegram_control"];
    }
    return [];
}

export function resolveUserEntitlements(user = {}) {
    const plan = String(user?.subscription?.plan || user?.plan || "free").trim().toLowerCase();
    const modules = normalizeEntitlementModules(user?.subscription?.modules || user?.modules || inferModulesFromPlan(plan));
    return {
        plan: inferPlanFromModules(modules.length > 0 ? modules : inferModulesFromPlan(plan)),
        modules,
        validUntil: user?.subscription?.validUntil || null,
    };
}
