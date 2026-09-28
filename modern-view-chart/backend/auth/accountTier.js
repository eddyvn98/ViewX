export function normalizeAccountTier(plan) {
    const raw = String(plan || "").trim().toLowerCase();
    return raw === "pro" || raw === "pro_plus" ? "pro" : "free";
}

function toTimestamp(value) {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

export function resolveUserAccountTier(user, nowMs = Date.now()) {
    const subscriptionPlan = user?.subscription?.plan;
    const rawPlan = subscriptionPlan || user?.plan || "free";
    const tier = normalizeAccountTier(rawPlan);
    if (tier === "free") return "free";

    const validUntil = toTimestamp(user?.subscription?.validUntil);
    if (validUntil != null && validUntil <= nowMs) return "free";

    return "pro";
}
