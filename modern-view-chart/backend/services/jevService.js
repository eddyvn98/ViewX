/**
 * @file jevService.js
 * @description Integration service for Jev AI System One Probabilistic Model.
 * Evaluates market state and technical indicators to produce calibrated
 * trend probabilities, entry recommendations (BUY/SELL/WAIT), and risk ratings.
 */

function resolveApiEndpoint(apiKey = "") {
    if (process.env.JEV_API_ENDPOINT) return process.env.JEV_API_ENDPOINT.trim();
    if (process.env.TYPESAFE_API_KEY || (apiKey && (apiKey.startsWith("ts_") || apiKey.toLowerCase().includes("typesafe")))) {
        return "https://api.typesafe.ai/v1/systemone";
    }
    return "https://jev-ai.pro/api/v1/systemone";
}

const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Calculate Exponential Moving Average (EMA)
 */
function calculateEMA(prices, period) {
    if (!prices || prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return Number(ema.toFixed(4));
}

/**
 * Calculate Relative Strength Index (RSI)
 */
function calculateRSI(prices, period = 14) {
    if (!prices || prices.length <= period) return 50;
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) {
            avgGain = (avgGain * (period - 1) + diff) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - diff) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Number((100 - 100 / (1 + rs)).toFixed(2));
}

function calculateATR(candles, period = 14) {
    if (!Array.isArray(candles) || candles.length < 2) return 0;
    const rows = candles
        .map((c) => ({
            high: Number(c.high ?? c.h),
            low: Number(c.low ?? c.l),
            close: Number(c.close ?? c.c),
        }))
        .filter((c) => Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));

    if (rows.length < 2) return 0;
    const ranges = [];
    for (let i = 1; i < rows.length; i++) {
        const prevClose = rows[i - 1].close;
        ranges.push(Math.max(
            rows[i].high - rows[i].low,
            Math.abs(rows[i].high - prevClose),
            Math.abs(rows[i].low - prevClose),
        ));
    }
    const window = ranges.slice(-Math.min(period, ranges.length));
    return window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : 0;
}

function normalizeDistribution(raw, keys, floor = 0.02) {
    const values = keys.map((key) => Math.max(0, Number(raw?.[key] ?? 0)));
    const total = values.reduce((sum, value) => sum + value, 0);
    const base = total > 0 ? values.map((value) => value / total) : keys.map(() => 1 / keys.length);
    const adjusted = base.map((value) => value + floor);
    const adjustedTotal = adjusted.reduce((sum, value) => sum + value, 0);
    return Object.fromEntries(keys.map((key, index) => [
        key,
        Number((adjusted[index] / adjustedTotal).toFixed(4)),
    ]));
}

function pctDiff(a, b) {
    const left = Number(a);
    const right = Number(b);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) return 0;
    return Number((((left - right) / Math.abs(right)) * 100).toFixed(4));
}


/**
 * Extract structured market state descriptor for AI evaluation
 */
export function extractMarketFeatures(candles = [], timesfmResult = null) {
    if (!Array.isArray(candles) || candles.length === 0) {
        return {
            currentPrice: 0,
            emaTrend: "neutral",
            rsi: 50,
            returnPct: 0,
            momentum5Bars: 0,
            momentum20Bars: 0,
            volatilityPct: 0,
            atr14: 0,
            volumeRatio20: 1,
            distanceToHigh20Pct: 0,
            distanceToLow20Pct: 0,
            timesfmDirection: timesfmResult?.direction || null,
            timesfmConfidence: timesfmResult?.confidence || null,
            timesfmMoveAtr: timesfmResult?.move_atr || null,
            timesfmEdge: timesfmResult?.edge || null,
        };
    }

    const closes = candles
        .map((c) => Number(c.close ?? c.c ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0);
    const currentPrice = closes[closes.length - 1] || 0;
    const prevPrice = closes[closes.length - 2] || currentPrice;
    const price5BarsAgo = closes[closes.length - 6] || closes[0] || currentPrice;
    const price20BarsAgo = closes[closes.length - 21] || closes[0] || currentPrice;

    const returnPct = pctDiff(currentPrice, prevPrice);
    const momentum5Bars = pctDiff(currentPrice, price5BarsAgo);
    const momentum20Bars = pctDiff(currentPrice, price20BarsAgo);

    const fastPeriod = Math.min(20, Math.max(5, Math.floor(closes.length * 0.4)));
    const slowPeriod = Math.min(50, Math.max(10, Math.floor(closes.length * 0.8)));
    const emaFast = calculateEMA(closes, fastPeriod);
    const emaSlow = calculateEMA(closes, slowPeriod);
    const ema200 = closes.length >= 200 ? calculateEMA(closes, 200) : null;

    let emaTrend = "neutral";
    if (emaFast && emaSlow && currentPrice > 0) {
        const emaDiffPct = (Math.abs(emaFast - emaSlow) / currentPrice) * 100;
        if (emaDiffPct < 0.08) {
            emaTrend = "neutral";
        } else if (emaFast > emaSlow) {
            emaTrend = currentPrice >= emaFast
                ? "strong_bullish"
                : currentPrice >= emaSlow
                ? "pullback_bullish"
                : "reversal_bearish";
        } else if (emaFast < emaSlow) {
            emaTrend = currentPrice <= emaFast
                ? "strong_bearish"
                : currentPrice <= emaSlow
                ? "pullback_bearish"
                : "reversal_bullish";
        }
    }

    const rsi = calculateRSI(closes, Math.min(14, Math.max(5, Math.floor(closes.length * 0.4))));
    const atr14 = calculateATR(candles, 14);
    const windowCandles = candles.slice(-20);
    const highs = windowCandles.map((c) => Number(c.high ?? c.h ?? currentPrice)).filter(Number.isFinite);
    const lows = windowCandles.map((c) => Number(c.low ?? c.l ?? currentPrice)).filter(Number.isFinite);
    const maxHigh = highs.length ? Math.max(...highs, currentPrice) : currentPrice;
    const minLow = lows.length ? Math.min(...lows, currentPrice) : currentPrice;
    const volatilityPct = currentPrice > 0 ? Number((((maxHigh - minLow) / currentPrice) * 100).toFixed(2)) : 0;

    const volumes = windowCandles
        .map((c) => Number(c.volume ?? c.v ?? 0))
        .filter((value) => Number.isFinite(value) && value >= 0);
    const currentVolume = volumes[volumes.length - 1] || 0;
    const averageVolume = volumes.length
        ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
        : 0;
    const volumeRatio20 = averageVolume > 0 ? Number((currentVolume / averageVolume).toFixed(3)) : 1;

    return {
        currentPrice,
        emaFast,
        emaSlow,
        ema200,
        emaTrend,
        emaFastVsSlowPct: pctDiff(emaFast, emaSlow),
        priceVsEmaFastPct: pctDiff(currentPrice, emaFast),
        priceVsEmaSlowPct: pctDiff(currentPrice, emaSlow),
        rsi,
        returnPct,
        momentum5Bars,
        momentum20Bars,
        volatilityPct,
        atr14: Number(atr14.toFixed(6)),
        atrPct: currentPrice > 0 ? Number(((atr14 / currentPrice) * 100).toFixed(4)) : 0,
        volumeRatio20,
        distanceToHigh20Pct: pctDiff(maxHigh, currentPrice),
        distanceToLow20Pct: pctDiff(currentPrice, minLow),
        timesfmDirection: timesfmResult?.direction || null,
        timesfmConfidence: timesfmResult ? Number(timesfmResult.confidence || 0) : null,
        timesfmMoveAtr: timesfmResult ? Number(timesfmResult.move_atr || 0) : null,
        timesfmEdge: timesfmResult?.edge || null,
    };
}

/**
 * Local Deterministic Calibrated Evaluator
 * Used as high-reliability fallback when API key is not set or network is offline
 */
export function evaluateLocally(features) {
    const {
        emaTrend,
        rsi,
        volatilityPct,
        momentum5Bars = 0,
        timesfmDirection,
        timesfmConfidence,
    } = features;

    // 1. Calculate Trend Probabilities (bullish, sideways, bearish) from market structure
    let bullishWeight = 0.5;
    let bearishWeight = 0.5;
    let sidewaysWeight = 0.5;

    if (emaTrend === "strong_bullish") {
        bullishWeight += 3.2;
    } else if (emaTrend === "bullish" || emaTrend === "pullback_bullish") {
        bullishWeight += 2.4;
    } else if (emaTrend === "strong_bearish") {
        bearishWeight += 3.2;
    } else if (emaTrend === "bearish" || emaTrend === "pullback_bearish") {
        bearishWeight += 2.4;
    } else if (emaTrend === "reversal_bearish") {
        bearishWeight += 1.2;
        sidewaysWeight += 1.5;
    } else if (emaTrend === "reversal_bullish") {
        bullishWeight += 1.2;
        sidewaysWeight += 1.5;
    } else {
        sidewaysWeight += 1.5;
    }

    // Momentum (5 bars) influence
    if (momentum5Bars > 0.3) bullishWeight += 1.0;
    else if (momentum5Bars < -0.3) bearishWeight += 1.0;

    // RSI momentum influence
    if (rsi >= 52 && rsi <= 72) {
        bullishWeight += 1.2;
    } else if (rsi >= 72) {
        bullishWeight += 0.4;
        sidewaysWeight += 0.8;
    } else if (rsi <= 48 && rsi >= 28) {
        bearishWeight += 1.2;
    } else if (rsi <= 28) {
        bearishWeight += 0.4;
        sidewaysWeight += 0.8;
    } else {
        sidewaysWeight += 0.5;
    }

    // TimesFM is advisory only. Ignore weak/noisy projections and cap influence.
    const timesfmUsable = features.timesfmEdge === "moderate" || features.timesfmEdge === "strong";
    if (timesfmUsable && timesfmDirection === "bullish") {
        const factor = Math.min(Math.max((timesfmConfidence || 50) / 100, 0.2), 0.9);
        bullishWeight += 0.35 * factor;
    } else if (timesfmUsable && timesfmDirection === "bearish") {
        const factor = Math.min(Math.max((timesfmConfidence || 50) / 100, 0.2), 0.9);
        bearishWeight += 0.35 * factor;
    }

    const totalWeight = bullishWeight + bearishWeight + sidewaysWeight;
    const pBullish = Number((bullishWeight / totalWeight).toFixed(2));
    const pBearish = Number((bearishWeight / totalWeight).toFixed(2));
    const pSideways = Number(Math.max(0, 1 - pBullish - pBearish).toFixed(2));

    // 2. Action recommendation (BUY, SELL, WAIT)
    let pBuy = 0.10;
    let pSell = 0.10;
    let pWait = 0.20;

    const bullishSetup = ["strong_bullish", "pullback_bullish"].includes(emaTrend) && momentum5Bars > 0;
    const bearishSetup = ["strong_bearish", "pullback_bearish"].includes(emaTrend) && momentum5Bars < 0;

    if (bullishSetup && pBullish > pBearish && pBullish >= 0.45 && rsi < 85) {
        pBuy = Number(Math.min(0.92, pBullish * 1.10).toFixed(2));
        pSell = Number(Math.max(0.04, pBearish * 0.4).toFixed(2));
        pWait = Number(Math.max(0.04, 1 - pBuy - pSell).toFixed(2));
    } else if (bearishSetup && pBearish > pBullish && pBearish >= 0.45 && rsi > 15) {
        pSell = Number(Math.min(0.92, pBearish * 1.10).toFixed(2));
        pBuy = Number(Math.max(0.04, pBullish * 0.4).toFixed(2));
        pWait = Number(Math.max(0.04, 1 - pBuy - pSell).toFixed(2));
    } else {
        pWait = Number(Math.min(0.85, 0.45 + pSideways * 0.4).toFixed(2));
        const rem = Math.max(0.10, 1 - pWait);
        pBuy = Number((rem * (pBullish / (pBullish + pBearish || 1))).toFixed(2));
        pSell = Number(Math.max(0.05, 1 - pWait - pBuy).toFixed(2));
    }

    let action = "WAIT";
    if (pBuy > pSell && pBuy >= pWait && pBuy >= 0.45) action = "BUY";
    else if (pSell > pBuy && pSell >= pWait && pSell >= 0.45) action = "SELL";

    const actionConfidence = Number(
        Math.min(
            0.96,
            Math.max(0.60, action === "BUY" ? pBuy : action === "SELL" ? pSell : pWait)
        ).toFixed(2)
    );

    // 3. Should Enter Score (0.00 to 1.00)
    let shouldEnterScore = 0.35;
    if (action === "BUY") {
        shouldEnterScore = Number((pBuy * (rsi < 70 ? 0.95 : 0.80)).toFixed(2));
    } else if (action === "SELL") {
        shouldEnterScore = Number((pSell * (rsi > 30 ? 0.95 : 0.80)).toFixed(2));
    } else {
        shouldEnterScore = Number((Math.max(pBuy, pSell) * 0.70).toFixed(2));
    }

    // 4. Risk assessment
    let riskLevel = "Moderate";
    let riskScoreNum = 0.45;
    if (volatilityPct > 3.0 || rsi > 78 || rsi < 22) {
        riskLevel = "High";
        riskScoreNum = 0.78;
    } else if (shouldEnterScore >= 0.60 && volatilityPct < 1.8 && rsi >= 38 && rsi <= 68) {
        riskLevel = "Low";
        riskScoreNum = 0.22;
    }

    return {
        trendProbabilities: {
            bullish: pBullish,
            sideways: pSideways,
            bearish: pBearish,
        },
        action,
        actionConfidence,
        actionProbabilities: {
            BUY: pBuy,
            WAIT: pWait,
            SELL: pSell,
        },
        shouldEnterScore: Math.min(0.99, Math.max(0.05, shouldEnterScore)),
        riskLevel,
        riskScore: riskScoreNum,
        engine: "jev-local-calibrated",
    };
}

/**
 * Call Jev AI System One API (POST https://jev-ai.pro/api/v1/systemone)
 */
async function callJevSystemOneApi(state, apiKey) {
    const payload = {
        model: "jev-latest",
        state,
        questions: {
            trend_direction: {
                type: "choice",
                instructions: "Infer direction from numeric observations. Do not treat any single indicator as a verdict; preserve uncertainty when evidence conflicts.",
                criteria: {
                    bullish: "Upward trend, bullish structure and positive momentum",
                    sideways: "Consolidation, flat, neutral or choppy indicators",
                    bearish: "Downward trend, bearish structure and negative momentum",
                },
            },
            should_enter: {
                type: "noul",
                instructions: "Is the current location a favorable entry now, considering trend stage, distance from recent extremes, volatility, momentum, and overextension? A valid trend can still be a poor entry.",
            },
            trade_action: {
                type: "choice",
                instructions: "Choose the action justified at the current price. Prefer WAIT when evidence is mixed, extended, or lacks a clear location advantage.",
                criteria: {
                    BUY: "Bullish trend or upward momentum favors entering or holding a Long position",
                    SELL: "Bearish trend or downward momentum favors entering or holding a Short position",
                    WAIT: "Choppy, uncertain, or conflicting signals without directional edge",
                },
            },
            risk_rating: {
                type: "score",
                instructions: "Rate the immediate trade risk level considering market volatility and overextension.",
                criteria: ["Low risk", "Moderate risk", "High risk"],
            },
        },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const endpoint = resolveApiEndpoint(apiKey);
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new Error(`Jev/TypeSafe AI returned HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data?.answers || null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Evaluate probability of market trend & entry setup
 * Main entry point for the service
 */
export async function evaluateMarketProbability({
    symbol,
    timeframe,
    candles = [],
    timesfmResult = null,
}) {
    const features = extractMarketFeatures(candles, timesfmResult);
    const apiKey = (process.env.TYPESAFE_API_KEY || process.env.JEV_AI_API_KEY || "").trim();

    // If API key is available, attempt Jev/TypeSafe Cloud invocation
    if (apiKey) {
        try {
            const state = {
                symbol: String(symbol || "CHART"),
                timeframe: String(timeframe || "15m"),
                currentPrice: features.currentPrice,
                observations: {
                    emaFastVsSlowPct: features.emaFastVsSlowPct,
                    priceVsEmaFastPct: features.priceVsEmaFastPct,
                    priceVsEmaSlowPct: features.priceVsEmaSlowPct,
                    rsi14: features.rsi,
                    return1BarPct: features.returnPct,
                    momentum5BarsPct: features.momentum5Bars,
                    momentum20BarsPct: features.momentum20Bars,
                    atr14: features.atr14,
                    atrPct: features.atrPct,
                    range20Pct: features.volatilityPct,
                    volumeRatio20: features.volumeRatio20,
                    distanceToHigh20Pct: features.distanceToHigh20Pct,
                    distanceToLow20Pct: features.distanceToLow20Pct,
                },
                timesfmAdvisory: features.timesfmEdge && features.timesfmEdge !== "noise"
                    ? {
                        direction: features.timesfmDirection,
                        moveAtr: features.timesfmMoveAtr,
                        edge: features.timesfmEdge,
                    }
                    : null,
            };

            const answers = await callJevSystemOneApi(state, apiKey);
            if (answers) {
                const trendAns = answers.trend_direction;
                const enterAns = answers.should_enter;
                const actionAns = answers.trade_action;
                const riskAns = answers.risk_rating;

                const rawTrendProbs = trendAns?.probabilities || {
                    bullish: trendAns?.choice === "bullish" ? 0.8 : 0.1,
                    sideways: trendAns?.choice === "sideways" ? 0.8 : 0.1,
                    bearish: trendAns?.choice === "bearish" ? 0.8 : 0.1,
                };
                const rawActionProbs = actionAns?.probabilities || {
                    BUY: actionAns?.choice === "BUY" ? 0.8 : 0.1,
                    WAIT: actionAns?.choice === "WAIT" ? 0.8 : 0.1,
                    SELL: actionAns?.choice === "SELL" ? 0.8 : 0.1,
                };

                const trendProbs = normalizeDistribution(rawTrendProbs, ["bullish", "sideways", "bearish"]);
                const actionProbs = normalizeDistribution(rawActionProbs, ["BUY", "WAIT", "SELL"]);

                const rawRiskScore = typeof riskAns?.score === "number" ? riskAns.score : 1;
                const riskLevel = rawRiskScore < 0.7 ? "Low" : rawRiskScore < 1.5 ? "Moderate" : "High";
                const riskScoreVal = riskLevel === "Low" ? 0.22 : riskLevel === "Moderate" ? 0.5 : 0.78;
                const isTypeSafe = resolveApiEndpoint(apiKey).includes("typesafe.ai");

                const rawAction = String(actionAns?.choice || "WAIT").toUpperCase();
                const actionConflictsWithStructure =
                    (rawAction === "BUY" && features.emaTrend === "reversal_bearish") ||
                    (rawAction === "SELL" && features.emaTrend === "reversal_bullish") ||
                    (rawAction === "BUY" && features.momentum5Bars <= -0.3) ||
                    (rawAction === "SELL" && features.momentum5Bars >= 0.3);

                const sortedActions = Object.entries(actionProbs).sort((a, b) => b[1] - a[1]);
                const actionMargin = (sortedActions[0]?.[1] || 0) - (sortedActions[1]?.[1] || 0);
                let action = actionConflictsWithStructure ? "WAIT" : rawAction;
                if (actionMargin < 0.08 || actionProbs.WAIT >= (actionProbs[action] ?? 0)) {
                    action = "WAIT";
                }

                const rawEnter = Number(enterAns?.noul ?? 0.5);
                const shouldEnterScore = Number(Math.max(0.05, Math.min(0.95, rawEnter)).toFixed(4));
                const actionConfidence = Number(
                    Math.max(0.05, Math.min(0.95, actionProbs[action] ?? Number(actionAns?.confidence ?? 0.5))).toFixed(4)
                );

                return {
                    trendProbabilities: trendProbs,
                    action,
                    actionConfidence,
                    actionProbabilities: actionProbs,
                    shouldEnterScore,
                    riskLevel,
                    riskScore: Number(riskScoreVal.toFixed(2)),
                    engine: isTypeSafe ? "typesafe-systemone" : "jev-ai-systemone",
                };
            }
        } catch (err) {
            console.warn("[JevService] Cloud API failed, gracefully falling back to local evaluator:", err.message);
        }
    }

    // Default or Fallback: Local Calibrated Evaluator
    return evaluateLocally(features);
}
