export const ENTITLEMENT_MODULES = new Set([
  "your_mt5",
  "mt5_trade",
  "binance_trade",
  "vn_gold",
  "telegram_notify",
  "telegram_control",
  "discord_bot",
  "ai_assistant",
]);

const MODULE_ALIASES = new Map([["mt5_trade", "your_mt5"]]);

function normalizeModuleKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  return MODULE_ALIASES.get(key) || key;
}

export function normalizeEntitlementModules(raw) {
  if (!Array.isArray(raw)) return [];
  const output = [];
  for (const item of raw) {
    const key = normalizeModuleKey(item);
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
    return ["your_mt5", "binance_trade", "vn_gold", "telegram_notify", "telegram_control", "discord_bot", "ai_assistant"];
  }
  if (normalized === "pro" || normalized.startsWith("pro")) {
    return ["your_mt5", "binance_trade", "vn_gold", "telegram_notify", "telegram_control", "discord_bot"];
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
