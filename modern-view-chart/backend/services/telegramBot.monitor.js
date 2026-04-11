import { userModel } from "../model/user.js";
import { sendTelegramMessage } from "./telegram.js";
import { calculateIndicatorSeries, formatOperatorLabel, indicatorNeedsPeriod, normalizeMaType } from "./telegramBot.indicators.js";
import { RSI } from "technicalindicators";
import { escapeHtml, formatPrice, nowIso } from "./telegramBot.helpers.js";
import { normalizeBotState, loadUserSetupState, patchUserSetupState, updateUserBotState, getActiveAlerts, getSignals, getScanners } from "./telegramBot.state.js";
import { hasTelegramModuleAccess } from "./telegramBot.access.js";
import { fetchCurrentPrice, fetchCandles, renderSignalsText, summarizeScannerSignals, renderScannerMatrixText, sendScannerMatrixSnapshot } from "./telegramBot.context.js";
import { calculateMovingAverage } from "./telegramBot.indicators.js";
import { BOT_SCAN_INTERVAL_MS } from "./telegramBot.constants.js";

// ─── Price alerts evaluator ───────────────────────────────────────────────────

export async function evaluatePriceAlerts(user, state) {
  const alerts = getActiveAlerts(state);
  if (!alerts.length) return { changed: false, state, runtimePatch: null };

  const runtime = normalizeBotState(user.telegram?.botState).runtime;
  const priceMemory = runtime.priceMemory && typeof runtime.priceMemory === "object" ? { ...runtime.priceMemory } : {};
  let changed = false;
  const nextAlerts = [];

  for (const alert of alerts) {
    const currentPrice = await fetchCurrentPrice(alert.symbol, user._id);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) { nextAlerts.push(alert); continue; }

    const prevPrice = Number(priceMemory[alert.id] || 0);
    let triggered = false;
    if (alert.type === "greater") triggered = currentPrice >= Number(alert.price || 0);
    else if (alert.type === "less") triggered = currentPrice <= Number(alert.price || 0);
    else if (alert.type === "crossing") {
      triggered = prevPrice > 0 && ((prevPrice < alert.price && currentPrice >= alert.price) || (prevPrice > alert.price && currentPrice <= alert.price));
    }

    if (triggered) {
      changed = true;
      await sendTelegramMessage({ chatId: user.telegram.chatId, text: `🔔 <b>Alert giá</b>\n${escapeHtml(alert.symbol)} chạm mức <b>${formatPrice(alert.price)}</b>\nGiá hiện tại: <b>${formatPrice(currentPrice)}</b>` });
      delete priceMemory[alert.id];
      continue;
    }
    priceMemory[alert.id] = currentPrice;
    nextAlerts.push(alert);
  }

  if (!changed) return { changed: false, state, runtimePatch: { priceMemory } };
  const allAlerts = Array.isArray(state.alerts) ? state.alerts : [];
  const nextIds = new Set(nextAlerts.map((item) => item.id));
  const merged = allAlerts.map((item) => (nextIds.has(item.id) ? nextAlerts.find((a) => a.id === item.id) : { ...item, active: false })).filter(Boolean);
  return { changed: true, state: { ...state, alerts: merged }, runtimePatch: { priceMemory } };
}

// ─── Indicator alerts evaluator ───────────────────────────────────────────────

export async function evaluateIndicatorAlerts(user) {
  const botState = normalizeBotState(user.telegram?.botState);
  const alerts = (botState.indicatorAlerts || []).filter((item) => item?.active);
  if (!alerts.length) return null;

  const runtime = botState.runtime && typeof botState.runtime === "object" ? structuredClone(botState.runtime) : {};
  runtime.indicatorMemory = runtime.indicatorMemory && typeof runtime.indicatorMemory === "object" ? runtime.indicatorMemory : {};
  let changed = false;

  for (const alert of alerts) {
    const candles = await fetchCandles(alert.symbol, alert.timeframe, user._id, 240);
    const closes = candles.map((item) => Number(item?.close || 0)).filter((v) => Number.isFinite(v) && v > 0);
    if (closes.length < 30) continue;

    const memoryKey = `${alert.id}`;

    if (alert.type === "indicator_rule") {
      const leftValues = calculateIndicatorSeries(alert.leftType, closes, alert.leftPeriod);
      const rightValues = calculateIndicatorSeries(alert.rightType, closes, alert.rightPeriod);
      const leftPrev = Number(leftValues[leftValues.length - 2]);
      const leftCurr = Number(leftValues[leftValues.length - 1]);
      const rightPrev = Number(rightValues[rightValues.length - 2]);
      const rightCurr = Number(rightValues[rightValues.length - 1]);
      if (![leftPrev, leftCurr, rightPrev, rightCurr].every(Number.isFinite)) continue;

      let triggered = false;
      if (alert.operator === "crosses_above") triggered = leftPrev <= rightPrev && leftCurr > rightCurr;
      else if (alert.operator === "crosses_below") triggered = leftPrev >= rightPrev && leftCurr < rightCurr;
      else if (alert.operator === ">") triggered = leftPrev <= rightPrev && leftCurr > rightCurr;
      else if (alert.operator === "<") triggered = leftPrev >= rightPrev && leftCurr < rightCurr;

      runtime.indicatorMemory[memoryKey] = { left: leftCurr, right: rightCurr };
      if (triggered) {
        alert.active = false;
        changed = true;
        const leftLabel = indicatorNeedsPeriod(alert.leftType) ? `${String(alert.leftType).toUpperCase()}${Number(alert.leftPeriod || 0)}` : String(alert.leftType).toUpperCase();
        const rightLabel = indicatorNeedsPeriod(alert.rightType) ? `${String(alert.rightType).toUpperCase()}${Number(alert.rightPeriod || 0)}` : String(alert.rightType).toUpperCase();
        await sendTelegramMessage({ chatId: user.telegram.chatId, text: `🔔 <b>Alert chỉ báo</b>\n${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)}\n${leftLabel} ${formatOperatorLabel(alert.operator).toLowerCase()} ${rightLabel}` });
      }
      continue;
    }

    if (alert.type === "rsi") {
      const values = RSI.calculate({ values: closes, period: Number(alert.period || 14) });
      if (values.length < 2) continue;
      const prev = Number(values[values.length - 2]);
      const current = Number(values[values.length - 1]);
      const threshold = Number(alert.threshold || 70);
      const crossed = alert.condition === "lt" ? prev >= threshold && current < threshold : prev <= threshold && current > threshold;
      runtime.indicatorMemory[memoryKey] = current;
      if (crossed) {
        alert.active = false;
        changed = true;
        await sendTelegramMessage({ chatId: user.telegram.chatId, text: `🔔 <b>Alert RSI</b>\n${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)}\nRSI hiện tại: <b>${current.toFixed(2)}</b>\nĐiều kiện: <b>${alert.condition === "lt" ? "<" : ">"} ${threshold}</b>` });
      }
      continue;
    }

    if (alert.type === "ma_cross" || alert.type === "hma_ema") {
      const fastType = normalizeMaType(alert.fastType || "HMA");
      const slowType = normalizeMaType(alert.slowType || "EMA");
      const fastPeriod = Number(alert.fastPeriod || alert.hmaPeriod || 20);
      const slowPeriod = Number(alert.slowPeriod || alert.emaPeriod || 50);
      const fastValues = calculateMovingAverage(fastType, closes, fastPeriod);
      const slowValues = calculateMovingAverage(slowType, closes, slowPeriod);
      const fastPrev = Number(fastValues[fastValues.length - 2]);
      const fastCurr = Number(fastValues[fastValues.length - 1]);
      const slowPrev = Number(slowValues[slowValues.length - 2]);
      const slowCurr = Number(slowValues[slowValues.length - 1]);
      if (![fastPrev, fastCurr, slowPrev, slowCurr].every(Number.isFinite)) continue;
      const crossed = alert.direction === "bear" ? fastPrev >= slowPrev && fastCurr < slowCurr : fastPrev <= slowPrev && fastCurr > slowCurr;
      runtime.indicatorMemory[memoryKey] = { fast: fastCurr, slow: slowCurr };
      if (crossed) {
        alert.active = false;
        changed = true;
        await sendTelegramMessage({ chatId: user.telegram.chatId, text: `🔔 <b>Alert MA cắt nhau</b>\n${escapeHtml(alert.symbol)} ${escapeHtml(alert.timeframe)}\n${fastType}${fastPeriod} ${alert.direction === "bear" ? "cắt xuống" : "cắt lên"} ${slowType}${slowPeriod}` });
      }
    }
  }

  if (!changed && Object.keys(runtime.indicatorMemory).length === 0) return null;
  return { ...botState, indicatorAlerts: botState.indicatorAlerts, runtime };
}

// ─── Strategy / scanner subscription evaluators ───────────────────────────────

export async function evaluateStrategySubscriptions(user, state) {
  const botState = normalizeBotState(user.telegram?.botState);
  const subs = (botState.strategySubscriptions || []).filter((item) => item?.active);
  if (!subs.length) return null;
  const signals = getSignals(state);
  let changed = false;

  for (const sub of subs) {
    const nextSignals = signals.filter((signal) => signal.strategyId === sub.strategyId && Number(signal.timestamp || 0) > Number(sub.lastSignalTs || 0));
    if (!nextSignals.length) continue;
    const newest = nextSignals.slice(0, 3).reverse();
    await sendTelegramMessage({ chatId: user.telegram.chatId, text: renderSignalsText(`📊 Strategy: ${sub.name || sub.strategyId}`, newest, state) });
    sub.lastSignalTs = Math.max(...nextSignals.map((item) => Number(item.timestamp || 0)));
    sub.updatedAt = nowIso();
    changed = true;
  }
  return changed ? botState : null;
}

export async function evaluateScannerSubscriptions(user, state) {
  const botState = normalizeBotState(user.telegram?.botState);
  const subs = (botState.scannerSubscriptions || []).filter((item) => item?.active);
  if (!subs.length) return null;
  const scanners = getScanners(state);
  let changed = false;

  for (const sub of subs) {
    const scanner = scanners.find((item) => item.id === sub.scannerId);
    if (!scanner) continue;
    const nextSignals = summarizeScannerSignals(scanner, state).filter((signal) => Number(signal.timestamp || 0) > Number(sub.lastSignalTs || 0));
    if (!nextSignals.length) continue;
    const snap = await sendScannerMatrixSnapshot(user.telegram.chatId, scanner, state, `Cập nhật: ${scanner.name || scanner.id}`);
    if (!snap?.ok) await sendTelegramMessage({ chatId: user.telegram.chatId, text: renderScannerMatrixText(scanner, state) });
    sub.lastSignalTs = Math.max(...nextSignals.map((item) => Number(item.timestamp || 0)));
    sub.updatedAt = nowIso();
    changed = true;
  }
  return changed ? botState : null;
}

// ─── Per-user scanner ─────────────────────────────────────────────────────────

async function scanTelegramUser(user) {
  if (!user?.telegram?.chatId || !hasTelegramModuleAccess(user)) return;
  const { state } = await loadUserSetupState(user._id);

  const priceEval = await evaluatePriceAlerts(user, state);
  const workingState = priceEval?.state || state;
  if (priceEval?.changed) await patchUserSetupState(user._id, () => workingState);
  if (priceEval?.runtimePatch) {
    await updateUserBotState(user._id, (botState) => {
      botState.runtime = { ...(botState.runtime || {}), ...priceEval.runtimePatch };
      return botState;
    });
  }

  const refreshedUser = priceEval?.changed || priceEval?.runtimePatch
    ? await userModel.findById(user._id).select("_id username displayName email telegram moduleAccess")
    : user;

  const indicatorEval = await evaluateIndicatorAlerts(refreshedUser);
  if (indicatorEval) await updateUserBotState(user._id, () => indicatorEval);

  const stateAfterUpdates = (await loadUserSetupState(user._id)).state;
  const strategyEval = await evaluateStrategySubscriptions(refreshedUser, stateAfterUpdates);
  if (strategyEval) await updateUserBotState(user._id, () => strategyEval);

  const scannerEval = await evaluateScannerSubscriptions(refreshedUser, stateAfterUpdates);
  if (scannerEval) await updateUserBotState(user._id, () => scannerEval);
}

// ─── Monitor loop export ──────────────────────────────────────────────────────

export function startTelegramBotMonitor() {
  const intervalId = setInterval(() => {
    userModel.find({ "telegram.isActive": true, "telegram.chatId": { $ne: "" } })
      .select("_id username displayName email telegram moduleAccess")
      .then((users) => Promise.allSettled(users.map((user) => scanTelegramUser(user))))
      .catch(() => null);
  }, BOT_SCAN_INTERVAL_MS);

  if (typeof intervalId.unref === "function") intervalId.unref();
  return { stop() { clearInterval(intervalId); } };
}
