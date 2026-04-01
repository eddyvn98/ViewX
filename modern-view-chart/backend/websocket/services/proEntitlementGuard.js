import { normalizeUserRole } from "../../auth/roles.js";

const PRO_PLAN_ALIASES = new Set(["pro", "pro_plus", "pro+", "premium"]);
const PRO_ROLE_ALIASES = new Set(["trader", "admin"]);
const KNOWN_MODULES = new Set([
    "your_mt5",
    "mt5_trade",
    "binance_trade",
    "telegram_notify",
    "telegram_control",
    "ai_assistant",
]);
const MODULE_ALIASES = new Map([
    ["mt5_trade", "your_mt5"],
]);

const MT5_PRO_ONLY_COMMANDS = new Set([
    "order",
    "place_order",
    "buy",
    "sell",
    "modify",
    "close",
    "delete",
    "cancel",
    "close_by_magic",
]);

const BINANCE_PRO_ONLY_COMMANDS = new Set(["buy", "sell", "close"]);

function normalizeValue(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizeModuleKey(value) {
    const key = normalizeValue(value);
    return MODULE_ALIASES.get(key) || key;
}

function pickFirstValue(...values) {
    for (const value of values) {
        const normalized = normalizeValue(value);
        if (normalized) return normalized;
    }
    return "";
}

function resolveValidUntil(meta = {}, data = {}) {
    return (
        data?.subscription?.validUntil ||
        data?.session?.subscription?.validUntil ||
        data?.session?.validUntil ||
        data?.user?.subscription?.validUntil ||
        meta?.subscription?.validUntil ||
        meta?.session?.subscription?.validUntil ||
        meta?.session?.validUntil ||
        meta?.user?.subscription?.validUntil ||
        null
    );
}

export function normalizeProPlan(plan) {
    return pickFirstValue(plan);
}

function normalizeModules(rawModules) {
    if (!Array.isArray(rawModules)) return [];
    const output = [];
    for (const moduleName of rawModules) {
        const normalized = normalizeModuleKey(moduleName);
        if (!normalized || !KNOWN_MODULES.has(normalized) || output.includes(normalized)) continue;
        output.push(normalized);
    }
    return output;
}

function inferModulesFromPlan(plan) {
    const normalizedPlan = normalizeValue(plan);
    if (!normalizedPlan) return [];
    if (normalizedPlan === "pro_plus" || normalizedPlan === "pro+" || normalizedPlan === "premium") {
        return ["your_mt5", "binance_trade", "telegram_notify", "telegram_control", "ai_assistant"];
    }
    if (normalizedPlan === "pro" || normalizedPlan.startsWith("pro")) {
        return ["your_mt5", "binance_trade", "telegram_notify", "telegram_control"];
    }
    return [];
}

function hasLiveModuleAccess(moduleName, meta = {}, data = {}) {
    const key = normalizeModuleKey(moduleName);
    const list =
        data?.moduleAccess ||
        data?.session?.moduleAccess ||
        data?.user?.moduleAccess ||
        meta?.moduleAccess ||
        [];
    if (!Array.isArray(list)) return false;
    const now = Date.now();
    const record = list.find((item) => normalizeValue(item?.module) === key);
    if (!record) return false;
    const trialEndsAt = record?.trialEndsAt ? new Date(record.trialEndsAt).getTime() : NaN;
    if (Number.isFinite(trialEndsAt) && trialEndsAt > now) return true;
    const activeUntil = record?.activeUntil ? new Date(record.activeUntil).getTime() : NaN;
    if (Number.isFinite(activeUntil) && activeUntil > now) return true;
    return false;
}

export function resolveEntitlementContext(meta = {}, data = {}) {
    const plan = normalizeProPlan(
        pickFirstValue(
            data?.plan,
            data?.subscription?.plan,
            data?.session?.plan,
            data?.user?.subscription?.plan,
            meta?.plan,
            meta?.subscription?.plan,
            meta?.session?.plan,
            meta?.user?.subscription?.plan,
        ),
    );

    const modules = normalizeModules(
        data?.modules ||
        data?.subscription?.modules ||
        data?.session?.modules ||
        data?.user?.subscription?.modules ||
        meta?.modules ||
        meta?.subscription?.modules ||
        meta?.session?.modules ||
        meta?.user?.subscription?.modules ||
        inferModulesFromPlan(plan),
    );

    return {
        authType: normalizeValue(meta?.authType),
        role: normalizeUserRole(
            pickFirstValue(
                data?.role,
                data?.user?.role,
                data?.session?.role,
                meta?.role,
            ),
        ),
        plan,
        modules,
        validUntil: resolveValidUntil(meta, data),
    };
}

function isExpired(validUntil) {
    if (!validUntil) return false;
    const expiresAt = new Date(validUntil);
    return Number.isFinite(expiresAt.getTime()) && Date.now() > expiresAt.getTime();
}

function isProPlan(plan) {
    const normalized = normalizeValue(plan);
    if (!normalized) return false;
    if (PRO_PLAN_ALIASES.has(normalized)) return true;
    return normalized.startsWith("pro");
}

export function hasProEntitlement(meta = {}, data = {}) {
    if (meta?.isServiceAuth || normalizeValue(meta?.authType) === "service") {
        return true;
    }

    const entitlement = resolveEntitlementContext(meta, data);
    if (isExpired(entitlement.validUntil)) return false;
    if (isProPlan(entitlement.plan)) return true;
    return PRO_ROLE_ALIASES.has(entitlement.role);
}

export function hasRequiredModule(moduleName, meta = {}, data = {}) {
    if (meta?.isServiceAuth || normalizeValue(meta?.authType) === "service") return true;
    const entitlement = resolveEntitlementContext(meta, data);
    if (isExpired(entitlement.validUntil)) return false;
    if (PRO_ROLE_ALIASES.has(entitlement.role)) return true;
    if (hasLiveModuleAccess(moduleName, meta, data)) return true;
    if (entitlement.modules.includes(normalizeModuleKey(moduleName))) return true;
    return hasProEntitlement(meta, data);
}

export function getProEntitlementReason(meta = {}, data = {}) {
    const entitlement = resolveEntitlementContext(meta, data);
    if (isExpired(entitlement.validUntil)) return "subscription_expired";
    return "pro_subscription_required";
}

export function getModuleEntitlementReason(moduleName, meta = {}, data = {}) {
    const entitlement = resolveEntitlementContext(meta, data);
    if (isExpired(entitlement.validUntil)) return "subscription_expired";
    return `module_required:${normalizeModuleKey(moduleName) || "unknown"}`;
}

export function isProOnlyMt5Command(command) {
    return MT5_PRO_ONLY_COMMANDS.has(normalizeValue(command));
}

export function isProOnlyBinanceCommand(command) {
    return BINANCE_PRO_ONLY_COMMANDS.has(normalizeValue(command));
}

export function isProOnlyCommand(topic, command) {
    const normalizedTopic = normalizeValue(topic);
    if (normalizedTopic === "mt5_command") return isProOnlyMt5Command(command);
    if (normalizedTopic === "binance_command") return isProOnlyBinanceCommand(command);
    return false;
}
