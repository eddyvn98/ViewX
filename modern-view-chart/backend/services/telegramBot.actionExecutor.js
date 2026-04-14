import {
  createAbsolutePriceAlert,
  createCrossAlertsFromActiveWebPair,
  createIndicatorAlert,
  createPriceAlert,
  deleteAllManagedAlerts,
  deleteManagedAlert,
  resolveAlertIdFromDeleteIntent,
} from "./telegramBot.alerts.js";
import { isIndicatorSupported, normalizeMaType } from "./telegramBot.indicators.js";
import { normalizeTimeframe } from "./telegramBot.helpers.js";

function resolveSymbolWithFallback(resolveSymbol, symbol) {
  return typeof resolveSymbol === "function" ? resolveSymbol(symbol) : symbol;
}

export async function executeTelegramAction({ userId, state, botState, intent, resolveSymbol }) {
  const payload = intent?.payload && typeof intent.payload === "object" ? intent.payload : {};

  if (intent?.type === "create_price_alert_percent") {
    const resolvedSymbol = resolveSymbolWithFallback(resolveSymbol, payload.symbol);
    const created = await createPriceAlert(userId, resolvedSymbol, payload.timeframe, payload.direction, payload.percent);
    return { type: intent.type, resolvedSymbol, ...created, payload };
  }

  if (intent?.type === "create_price_alert_absolute") {
    const resolvedSymbol = resolveSymbolWithFallback(resolveSymbol, payload.symbol);
    const targetPrice = Number(payload.targetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      throw new Error("missing_target_price");
    }
    const created = await createAbsolutePriceAlert(userId, resolvedSymbol, payload.timeframe, payload.operator, payload.targetPrice);
    return { type: intent.type, resolvedSymbol, ...created, payload };
  }

  if (intent?.type === "create_rsi_alert") {
    const resolvedTimeframe = normalizeTimeframe(payload.timeframe);
    const period = Math.max(2, Number(payload.period || 14));
    const condition = payload.condition === "lt" ? "lt" : "gt";
    const threshold = Number(payload.threshold);

    if (payload.allSymbols) {
      let createdCount = 0;
      const symbols = Array.isArray(state?.watchlist) ? state.watchlist : [];
      for (const item of symbols) {
        const resolvedSymbol = resolveSymbolWithFallback(resolveSymbol, item);
        await createIndicatorAlert(userId, {
          type: "rsi",
          symbol: resolvedSymbol,
          timeframe: resolvedTimeframe,
          condition,
          threshold,
          period,
        });
        createdCount += 1;
      }
      return { type: intent.type, payload, resolvedTimeframe, period, condition, threshold, createdCount };
    }

    const resolvedSymbol = resolveSymbolWithFallback(resolveSymbol, payload.symbol);
    await createIndicatorAlert(userId, {
      type: "rsi",
      symbol: resolvedSymbol,
      timeframe: resolvedTimeframe,
      condition,
      threshold,
      period,
    });
    return { type: intent.type, payload, resolvedSymbol, resolvedTimeframe, period, condition, threshold };
  }

  if (intent?.type === "create_ma_cross_alert") {
    const fastType = normalizeMaType(payload.fastType);
    const slowType = normalizeMaType(payload.slowType);
    const fastPeriod = Math.max(2, Number(payload.fastPeriod || 9));
    const slowPeriod = Math.max(2, Number(payload.slowPeriod || 20));
    if (fastType === slowType && fastPeriod === slowPeriod) {
      throw new Error("duplicate_ma_pair");
    }
    const resolvedSymbol = resolveSymbolWithFallback(resolveSymbol, payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    const direction = payload.direction === "bear" ? "bear" : "bull";
    await createIndicatorAlert(userId, {
      type: "ma_cross",
      symbol: resolvedSymbol,
      timeframe,
      fastType,
      fastPeriod,
      slowType,
      slowPeriod,
      direction,
    });
    return { type: intent.type, payload, resolvedSymbol, timeframe, fastType, fastPeriod, slowType, slowPeriod, direction };
  }

  if (intent?.type === "create_indicator_alert") {
    const leftType = String(payload.leftType || "").toUpperCase();
    const rightType = String(payload.rightType || "").toUpperCase();
    const leftPeriod = Math.max(0, Number(payload.leftPeriod || 0));
    const rightPeriod = Math.max(0, Number(payload.rightPeriod || 0));
    if (!isIndicatorSupported(leftType) || !isIndicatorSupported(rightType)) {
      throw new Error("unsupported_indicator_pair");
    }
    if (leftType === rightType && leftPeriod === rightPeriod) {
      throw new Error("duplicate_indicator_pair");
    }
    const resolvedSymbol = resolveSymbolWithFallback(resolveSymbol, payload.symbol);
    const timeframe = normalizeTimeframe(payload.timeframe);
    await createIndicatorAlert(userId, {
      type: "indicator_rule",
      symbol: resolvedSymbol,
      timeframe,
      leftType,
      leftPeriod,
      operator: payload.operator || ">",
      rightType,
      rightPeriod,
    });
    return { type: intent.type, payload, resolvedSymbol, timeframe, leftType, leftPeriod, rightType, rightPeriod, operator: payload.operator || ">" };
  }

  if (intent?.type === "create_web_indicator_alert") {
    const result = await createCrossAlertsFromActiveWebPair(
      userId,
      state,
      payload.timeframe || "",
      payload.symbol ? resolveSymbolWithFallback(resolveSymbol, payload.symbol) : "",
    );
    return { type: intent.type, payload, ...result };
  }

  if (intent?.type === "delete_alert") {
    const alertId = resolveAlertIdFromDeleteIntent(payload, state, botState);
    if (!alertId) return { type: intent.type, payload, removed: false, alertId: "" };
    const removed = await deleteManagedAlert(userId, alertId);
    return { type: intent.type, payload, removed, alertId };
  }

  if (intent?.type === "delete_all_alerts") {
    await deleteAllManagedAlerts(userId);
    return { type: intent.type, payload, removed: true };
  }

  throw new Error(`unsupported_action:${String(intent?.type || "unknown")}`);
}
