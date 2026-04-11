import { userModel } from "../model/user.js";
import userStateModel from "../model/user_state.js";
import { normalizeSymbol } from "./telegramBot.helpers.js";
import { WATCHLIST_FALLBACK, SYMBOL_LIMIT } from "./telegramBot.constants.js";

export function normalizeBotState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    indicatorAlerts: Array.isArray(source.indicatorAlerts) ? source.indicatorAlerts : [],
    strategySubscriptions: Array.isArray(source.strategySubscriptions) ? source.strategySubscriptions : [],
    scannerSubscriptions: Array.isArray(source.scannerSubscriptions) ? source.scannerSubscriptions : [],
    runtime: source.runtime && typeof source.runtime === "object" ? source.runtime : {},
  };
}

export async function loadUserSetupState(userId) {
  const doc = await userStateModel.findOne({ scopeType: "user", scopeId: String(userId) }).select("state revision").lean();
  return {
    revision: Number.isFinite(Number(doc?.revision)) ? Number(doc.revision) : 0,
    state: doc?.state && typeof doc.state === "object" ? doc.state : {},
  };
}

export async function patchUserSetupState(userId, updater) {
  const scopeId = String(userId);
  const existing = await userStateModel.findOne({ scopeType: "user", scopeId }).select("state revision");
  const currentState = existing?.state && typeof existing.state === "object" ? existing.state : {};
  const nextState = updater(structuredClone(currentState));

  if (!existing) {
    await userStateModel.create({
      scopeType: "user",
      scopeId,
      state: nextState,
      schemaVersion: 1,
      revision: 1,
      clientUpdatedAt: new Date(),
      lastSourceClientId: "telegram_bot",
      lastSyncedAt: new Date(),
    });
    return nextState;
  }

  existing.state = nextState;
  existing.revision = Number.isFinite(Number(existing.revision)) ? Number(existing.revision) + 1 : 1;
  existing.clientUpdatedAt = new Date();
  existing.lastSourceClientId = "telegram_bot";
  existing.lastSyncedAt = new Date();
  await existing.save();
  return nextState;
}

export async function updateUserBotState(userId, updater) {
  const user = await userModel.findById(userId).select("telegram");
  if (!user?._id) return null;
  const current = normalizeBotState(user.telegram?.botState);
  const next = updater(structuredClone(current));
  user.telegram = { ...(user.telegram || {}), botState: next };
  await user.save();
  return next;
}

export function getWatchlist(state) {
  const raw = Array.isArray(state?.watchlist) ? state.watchlist : [];
  const unique = Array.from(new Set(raw.map(normalizeSymbol).filter(Boolean)));
  return unique.length > 0 ? unique : WATCHLIST_FALLBACK;
}

export function getQuickSymbols(state) {
  return getWatchlist(state).slice(0, SYMBOL_LIMIT);
}

export function getStrategies(state) {
  return Array.isArray(state?.strategy?.strategies) ? state.strategy.strategies : [];
}

export function getSignals(state) {
  const signals = Array.isArray(state?.strategy?.signals) ? state.strategy.signals : [];
  return [...signals].sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0));
}

export function getScanners(state) {
  return Array.isArray(state?.strategy?.matrixScanners) ? state.strategy.matrixScanners : [];
}

export function getVirtualPositions(state) {
  return Array.isArray(state?.strategy?.virtualPositions) ? state.strategy.virtualPositions : [];
}

export function getActiveAlerts(state) {
  return Array.isArray(state?.alerts) ? state.alerts.filter((item) => item?.active) : [];
}
