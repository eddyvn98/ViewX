import { normalizeMaType, isIndicatorSupported, normalizeIndicatorType, getIndicatorPeriodOptions } from "./telegramBot.indicators.js";
import { normalizeSymbol, normalizeTimeframe, createId, nowIso } from "./telegramBot.helpers.js";
import { patchUserSetupState, updateUserBotState, getStrategies, getSignals, getScanners } from "./telegramBot.state.js";
import { summarizeScannerSignals } from "./telegramBot.context.js";
import { fetchCurrentPrice } from "./telegramBot.context.js";
import { buildManagedAlertRows } from "./telegramBot.ui.js";

// ─── Price alerts ─────────────────────────────────────────────────────────────

export async function createPriceAlert(userId, symbol, timeframe, direction, percent) {
  const currentPrice = await fetchCurrentPrice(symbol, userId);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error("Không lấy được giá hiện tại cho symbol này.");
  }
  const factor = Number(percent || 0) / 100;
  const targetPrice = direction === "gt" ? currentPrice * (1 + factor) : currentPrice * (1 - factor);
  await patchUserSetupState(userId, (state) => {
    const currentAlerts = Array.isArray(state.alerts) ? state.alerts : [];
    currentAlerts.push({
      id: createId("price"),
      symbol: normalizeSymbol(symbol),
      price: Number(targetPrice.toFixed(6)),
      active: true,
      type: direction === "gt" ? "greater" : "less",
      createdAt: Date.now(),
      note: `bot_price:${normalizeTimeframe(timeframe)}`,
    });
    state.alerts = currentAlerts;
    return state;
  });
  return { currentPrice, targetPrice: Number(targetPrice.toFixed(6)) };
}

export async function createAbsolutePriceAlert(userId, symbol, timeframe, operator, targetPrice) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedTimeframe = normalizeTimeframe(timeframe);
  const normalizedOperator = operator === "<" ? "<" : ">";
  const safeTargetPrice = Number(targetPrice);
  if (!Number.isFinite(safeTargetPrice) || safeTargetPrice <= 0) throw new Error("Moc gia khong hop le.");
  await patchUserSetupState(userId, (state) => {
    const currentAlerts = Array.isArray(state.alerts) ? state.alerts : [];
    currentAlerts.push({
      id: createId("price"),
      symbol: normalizedSymbol,
      price: Number(safeTargetPrice.toFixed(6)),
      active: true,
      type: normalizedOperator === "<" ? "less" : "greater",
      createdAt: Date.now(),
      note: `bot_price:${normalizedTimeframe}`,
    });
    state.alerts = currentAlerts;
    return state;
  });
  const currentPrice = await fetchCurrentPrice(normalizedSymbol, userId);
  return {
    currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
    targetPrice: Number(safeTargetPrice.toFixed(6)),
  };
}

// ─── Indicator alerts ─────────────────────────────────────────────────────────

export async function createIndicatorAlert(userId, config) {
  const record = { id: createId(config.type), active: true, createdAt: Date.now(), ...config };
  await updateUserBotState(userId, (botState) => {
    botState.indicatorAlerts = [...(Array.isArray(botState.indicatorAlerts) ? botState.indicatorAlerts : []), record];
    return botState;
  });
  return record;
}

export async function deleteManagedAlert(userId, alertId) {
  let removed = false;
  await patchUserSetupState(userId, (state) => {
    const current = Array.isArray(state.alerts) ? state.alerts : [];
    state.alerts = current.filter((item) => {
      const keep = String(item?.id || "") !== String(alertId);
      if (!keep) removed = true;
      return keep;
    });
    return state;
  });
  await updateUserBotState(userId, (botState) => {
    const current = Array.isArray(botState.indicatorAlerts) ? botState.indicatorAlerts : [];
    botState.indicatorAlerts = current.filter((item) => {
      const keep = String(item?.id || "") !== String(alertId);
      if (!keep) removed = true;
      return keep;
    });
    return botState;
  });
  return removed;
}

export function resolveAlertIdFromDeleteIntent(payload, state, botState) {
  const mode = String(payload?.by || "").trim().toLowerCase();
  if (mode === "index") {
    const index = Number(payload?.value || 0);
    if (!Number.isFinite(index) || index <= 0) return "";
    const rows = buildManagedAlertRows(state, botState);
    return String(rows[index - 1]?.id || "");
  }
  return String(payload?.value || "").trim();
}

// ─── Strategy / scanner subscriptions ────────────────────────────────────────

export async function toggleStrategySubscription(userId, state, index) {
  const strategies = getStrategies(state);
  const strategy = strategies[index];
  if (!strategy?.id) throw new Error("Không tìm thấy strategy.");
  const latestSignalTs = Math.max(0, ...getSignals(state).filter((item) => item.strategyId === strategy.id).map((item) => Number(item.timestamp || 0)));
  const next = await updateUserBotState(userId, (botState) => {
    const current = Array.isArray(botState.strategySubscriptions) ? botState.strategySubscriptions : [];
    const existing = current.find((item) => item.strategyId === strategy.id);
    if (existing) {
      existing.active = !existing.active;
      existing.updatedAt = nowIso();
      if (existing.active) existing.lastSignalTs = latestSignalTs;
    } else {
      current.push({ strategyId: strategy.id, name: strategy.name || strategy.id, active: true, lastSignalTs: latestSignalTs, updatedAt: nowIso() });
    }
    botState.strategySubscriptions = current;
    return botState;
  });
  const active = Array.isArray(next?.strategySubscriptions) && next.strategySubscriptions.find((item) => item.strategyId === strategy.id)?.active;
  return { strategy, active: Boolean(active) };
}

export async function toggleScannerSubscription(userId, state, index) {
  const scanners = getScanners(state);
  const scanner = scanners[index];
  if (!scanner?.id) throw new Error("Không tìm thấy scanner.");
  const latestSignalTs = Math.max(0, ...summarizeScannerSignals(scanner, state).map((item) => Number(item.timestamp || 0)));
  const next = await updateUserBotState(userId, (botState) => {
    const current = Array.isArray(botState.scannerSubscriptions) ? botState.scannerSubscriptions : [];
    const existing = current.find((item) => item.scannerId === scanner.id);
    if (existing) {
      existing.active = !existing.active;
      existing.updatedAt = nowIso();
      if (existing.active) existing.lastSignalTs = latestSignalTs;
    } else {
      current.push({ scannerId: scanner.id, name: scanner.name || scanner.id, active: true, lastSignalTs: latestSignalTs, updatedAt: nowIso() });
    }
    botState.scannerSubscriptions = current;
    return botState;
  });
  const active = Array.isArray(next?.scannerSubscriptions) && next.scannerSubscriptions.find((item) => item.scannerId === scanner.id)?.active;
  return { scanner, active: Boolean(active) };
}

// ─── Web-driven cross alerts ──────────────────────────────────────────────────

function getActiveChartContext(state) {
  const tabs = state?.tabs && typeof state.tabs === "object" ? state.tabs : {};
  const activeTab = tabs[String(state?.activeTabId || "")];
  if (!activeTab || typeof activeTab !== "object") return null;
  const activeChart = (activeTab.charts || {})[String(activeTab?.activeChartId || "")];
  if (!activeChart || typeof activeChart !== "object") return null;
  const symbol = normalizeSymbol(activeChart.symbol || "");
  if (!symbol) return null;
  return { chartId: String(activeTab.activeChartId), symbol, timeframe: normalizeTimeframeFromInterval(activeChart.interval) };
}

function normalizeTimeframeFromInterval(interval) {
  const raw = String(interval || "").trim().toLowerCase();
  if (raw === "1" || raw === "1m") return "1m";
  if (raw === "5" || raw === "5m") return "5m";
  if (raw === "15" || raw === "15m") return "15m";
  if (raw === "60" || raw === "1h" || raw === "h1") return "1h";
  if (raw === "240" || raw === "4h" || raw === "h4") return "4h";
  return "5m";
}

function getAllChartContexts(state) {
  const tabs = state?.tabs && typeof state.tabs === "object" ? state.tabs : {};
  const contexts = [];
  for (const tab of Object.values(tabs)) {
    if (!tab || typeof tab !== "object") continue;
    const charts = tab?.charts && typeof tab.charts === "object" ? tab.charts : {};
    for (const [chartId, chart] of Object.entries(charts)) {
      if (!chart || typeof chart !== "object") continue;
      const symbol = normalizeSymbol(chart.symbol || "");
      if (!symbol) continue;
      contexts.push({ chartId, symbol, timeframe: normalizeTimeframeFromInterval(chart.interval) });
    }
  }
  return contexts;
}

function collectIndicatorConfigsFromChart(state, chartId) {
  const chartIndicators = state?.chartIndicators && typeof state.chartIndicators === "object" ? state.chartIndicators : {};
  return (Array.isArray(chartIndicators[chartId]) ? chartIndicators[chartId] : []).filter((item) => item && typeof item === "object");
}

function extractPeriodsByTypeFromIndicators(indicators, type) {
  const normalizedType = normalizeIndicatorType(type);
  if (!normalizedType) return [];
  const pickPeriod = (indicator) => {
    const params = indicator?.params && typeof indicator.params === "object" ? indicator.params : {};
    for (const candidate of [params.period, params.length, params.fast, params.kPeriod, params.rsiPeriod, params.maPeriod, params.conversionPeriod, params.basePeriod]) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) return Math.max(2, Math.round(numeric));
    }
    return 0;
  };
  const periods = indicators
    .filter((item) => normalizeIndicatorType(item?.type) === normalizedType)
    .map(pickPeriod)
    .filter((p) => Number.isFinite(p) && p > 0)
    .map((p) => Math.max(2, Math.round(p)));
  if (!periods.length && ["PRICE", "VWAP", "OBV", "PSAR"].includes(normalizedType)) return [0];
  return Array.from(new Set(periods));
}

export async function createCrossAlertsFromWebIndicators(userId, state, leftType, rightType, requestedTimeframe = "", requestedSymbol = "") {
  if (!isIndicatorSupported(leftType) || !isIndicatorSupported(rightType)) {
    throw new Error(`Bot chưa hỗ trợ tính giao cắt cho cặp ${leftType}/${rightType}.`);
  }
  const activeContext = getActiveChartContext(state);
  const allContexts = getAllChartContexts(state);
  const candidates = (allContexts.length ? allContexts : (activeContext ? [activeContext] : []))
    .filter((ctx) => (!requestedTimeframe || ctx.timeframe === requestedTimeframe))
    .filter((ctx) => (!requestedSymbol || ctx.symbol === requestedSymbol));
  const ordered = candidates.length ? candidates : (activeContext ? [activeContext] : []);

  let context = null;
  let indicators = [];
  for (const candidate of ordered) {
    const inChart = collectIndicatorConfigsFromChart(state, candidate.chartId);
    const leftPeriods = leftType === "PRICE" ? [0] : extractPeriodsByTypeFromIndicators(inChart, leftType);
    const rightPeriods = rightType === "PRICE" ? [0] : extractPeriodsByTypeFromIndicators(inChart, rightType);
    if (leftPeriods.length && rightPeriods.length) { context = candidate; indicators = inChart; break; }
  }
  if (!context && activeContext) { context = activeContext; indicators = collectIndicatorConfigsFromChart(state, context.chartId); }
  if (!context) throw new Error("Không tìm thấy chart đang mở trên web để suy luận thông số chỉ báo.");

  const leftPeriods = leftType === "PRICE" ? [0] : extractPeriodsByTypeFromIndicators(indicators, leftType);
  const rightPeriods = rightType === "PRICE" ? [0] : extractPeriodsByTypeFromIndicators(indicators, rightType);
  if (!leftPeriods.length || !rightPeriods.length) {
    throw new Error(`Không thấy đủ ${leftType}/${rightType} trên chart đang mở. Hãy bật chúng trên web trước hoặc gửi lệnh có chu kỳ cụ thể.`);
  }

  let createdCount = 0;
  for (const lp of leftPeriods) {
    for (const rp of rightPeriods) {
      if (leftType === rightType && lp === rp) continue;
      await createIndicatorAlert(userId, { type: "indicator_rule", symbol: context.symbol, timeframe: context.timeframe, leftType, leftPeriod: lp, operator: "crosses_above", rightType, rightPeriod: rp });
      await createIndicatorAlert(userId, { type: "indicator_rule", symbol: context.symbol, timeframe: context.timeframe, leftType, leftPeriod: lp, operator: "crosses_below", rightType, rightPeriod: rp });
      createdCount += 2;
    }
  }
  if (createdCount <= 0) throw new Error("Không tạo được alert vì cặp chỉ báo đang trùng hoàn toàn.");
  return { createdCount, symbol: context.symbol, timeframe: context.timeframe, leftPeriods, rightPeriods };
}
