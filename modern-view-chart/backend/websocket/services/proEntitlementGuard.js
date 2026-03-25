import { normalizeUserRole } from "../../auth/roles.js";

const PRO_PLAN_ALIASES = new Set(["pro", "pro_plus", "pro+", "premium"]);
const PRO_ROLE_ALIASES = new Set(["trader", "admin"]);

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

export function resolveEntitlementContext(meta = {}, data = {}) {
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
        plan: normalizeProPlan(
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
        ),
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

export function getProEntitlementReason(meta = {}, data = {}) {
    const entitlement = resolveEntitlementContext(meta, data);
    if (isExpired(entitlement.validUntil)) return "subscription_expired";
    return "pro_subscription_required";
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
