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
            volatilityPct: 0,
            timesfmDirection: timesfmResult?.direction || "sideways",
            timesfmConfidence: timesfmResult?.confidence || 50,
        };
    }

    const closes = candles.map((c) => Number(c.close || c.c || 0)).filter((v) => Number.isFinite(v) && v > 0);
    const currentPrice = closes[closes.length - 1] || 0;
    const prevPrice = closes[closes.length - 2] || currentPrice;
    const returnPct = prevPrice > 0 ? Number((((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2)) : 0;

    const fastPeriod = Math.min(20, Math.max(5, Math.floor(closes.length * 0.4)));
    const slowPeriod = Math.min(50, Math.max(10, Math.floor(closes.length * 0.8)));

    const emaFast = calculateEMA(closes, fastPeriod);
    const emaSlow = calculateEMA(closes, slowPeriod);
    const ema200 = closes.length >= 200 ? calculateEMA(closes, 200) : null;

    let emaTrend = "neutral";
    if (emaFast && emaSlow) {
        if (currentPrice > emaFast && emaFast >= emaSlow) {
            emaTrend = "strong_bullish";
        } else if (currentPrice < emaFast && emaFast <= emaSlow) {
            emaTrend = "strong_bearish";
        } else if (emaFast > emaSlow || currentPrice > emaSlow) {
            emaTrend = "bullish";
        } else if (emaFast < emaSlow || currentPrice < emaSlow) {
            emaTrend = "bearish";
        }
    }

    const rsi = calculateRSI(closes, Math.min(14, Math.max(5, Math.floor(closes.length * 0.4))));

    // Calculate normalized volatility
    const windowCandles = candles.slice(-20);
    const highs = windowCandles.map((c) => Number(c.high || c.h || currentPrice));
    const lows = windowCandles.map((c) => Number(c.low || c.l || currentPrice));
    const maxHigh = Math.max(...highs, currentPrice);
    const minLow = Math.min(...lows, currentPrice);
    const volatilityPct = currentPrice > 0 ? Number((((maxHigh - minLow) / currentPrice) * 100).toFixed(2)) : 0;

    return {
        currentPrice,
        emaFast,
        emaSlow,
        ema200,
        emaTrend,
        rsi,
        returnPct,
        volatilityPct,
        timesfmDirection: timesfmResult?.direction || "sideways",
        timesfmConfidence: Number(timesfmResult?.confidence || 50),
        timesfmDeltaPct: Number(timesfmResult?.delta_pct || 0),
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
        timesfmDirection,
        timesfmConfidence,
        timesfmDeltaPct,
        volatilityPct,
    } = features;

    // 1. Calculate Trend Probabilities (bullish, sideways, bearish)
    let bullishWeight = 1.0;
    let bearishWeight = 1.0;
    let sidewaysWeight = 1.0;

    if (emaTrend === "strong_bullish") bullishWeight += 2.0;
    else if (emaTrend === "bullish") bullishWeight += 1.2;
    else if (emaTrend === "strong_bearish") bearishWeight += 2.0;
    else if (emaTrend === "bearish") bearishWeight += 1.2;
    else sidewaysWeight += 1.0;

    // TimesFM influence
    const tfmConfFactor = Math.min(Math.max(timesfmConfidence / 100, 0.2), 0.95);
    if (timesfmDirection === "bullish") {
        bullishWeight += 2.5 * tfmConfFactor;
        if (timesfmDeltaPct > 0.3) bullishWeight += 0.8;
    } else if (timesfmDirection === "bearish") {
        bearishWeight += 2.5 * tfmConfFactor;
        if (timesfmDeltaPct < -0.3) bearishWeight += 0.8;
    } else {
        sidewaysWeight += 1.8;
    }

    // RSI influence (overbought > 80, oversold < 20)
    if (rsi > 80) {
        bullishWeight *= 0.80;
        sidewaysWeight += 0.5;
    } else if (rsi < 20) {
        bearishWeight *= 0.80;
        sidewaysWeight += 0.5;
    } else if (rsi >= 50) {
        bullishWeight += 0.5;
    } else {
        bearishWeight += 0.5;
    }

    const totalWeight = bullishWeight + bearishWeight + sidewaysWeight;
    const pBullish = Number((bullishWeight / totalWeight).toFixed(2));
    const pBearish = Number((bearishWeight / totalWeight).toFixed(2));
    const pSideways = Number(Math.max(0, 1 - pBullish - pBearish).toFixed(2));

    // 2. Action recommendation (BUY, SELL, WAIT)
    let pBuy = 0.10;
    let pSell = 0.10;
    let pWait = 0.20;

    if (pBullish > 0.50 && pBullish > pBearish * 1.3 && rsi < 85) {
        pBuy = Number(Math.min(0.92, pBullish * 1.05).toFixed(2));
        pSell = Number(Math.max(0.03, pBearish * 0.4).toFixed(2));
        pWait = Number(Math.max(0.05, 1 - pBuy - pSell).toFixed(2));
    } else if (pBearish > 0.50 && pBearish > pBullish * 1.3 && rsi > 15) {
        pSell = Number(Math.min(0.92, pBearish * 1.05).toFixed(2));
        pBuy = Number(Math.max(0.03, pBullish * 0.4).toFixed(2));
        pWait = Number(Math.max(0.05, 1 - pBuy - pSell).toFixed(2));
    } else {
        pWait = Number((0.55 + pSideways * 0.35).toFixed(2));
        pBuy = Number(((1 - pWait) * (pBullish / (pBullish + pBearish || 1))).toFixed(2));
        pSell = Number(Math.max(0.05, 1 - pWait - pBuy).toFixed(2));
    }

    let action = "WAIT";
    if (pBuy > pSell && pBuy >= 0.55) action = "BUY";
    else if (pSell > pBuy && pSell >= 0.55) action = "SELL";

    const actionConfidence = Number(
        Math.min(
            0.96,
            Math.max(0.60, action === "BUY" ? pBuy : action === "SELL" ? pSell : pWait)
        ).toFixed(2)
    );

    // 3. Should Enter Score (0.00 to 1.00)
    let shouldEnterScore = 0.25;
    if (action === "BUY") {
        shouldEnterScore = Number((pBuy * (rsi < 68 ? 0.95 : 0.80)).toFixed(2));
    } else if (action === "SELL") {
        shouldEnterScore = Number((pSell * (rsi > 32 ? 0.95 : 0.80)).toFixed(2));
    } else {
        shouldEnterScore = Number((Math.max(pBuy, pSell) * 0.6).toFixed(2));
    }

    // 4. Risk assessment
    let riskLevel = "Moderate";
    let riskScoreNum = 0.45;
    if (volatilityPct > 3.0 || rsi > 75 || rsi < 25) {
        riskLevel = "High";
        riskScoreNum = 0.78;
    } else if (shouldEnterScore >= 0.70 && volatilityPct < 1.8 && rsi >= 40 && rsi <= 65) {
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
                instructions: "What is the most probable market trend direction based on structure and indicator momentum?",
                criteria: {
                    bullish: "Upward momentum and bullish indicators",
                    sideways: "Consolidation, neutral or mixed indicators",
                    bearish: "Downward momentum and bearish indicators",
                },
            },
            should_enter: {
                type: "noul",
                instructions: "Is this a favorable, high-probability entry setup with acceptable risk?",
            },
            trade_action: {
                type: "choice",
                instructions: "What trade action is justified at this current bar?",
                criteria: {
                    BUY: "Confirmed bullish setup to enter Long",
                    SELL: "Confirmed bearish setup to enter Short",
                    WAIT: "Wait for clearer confirmation or avoid choppy market",
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
                technicalSummary: {
                    emaTrend: features.emaTrend,
                    rsi14: features.rsi,
                    returnPct: features.returnPct,
                    volatilityPct: features.volatilityPct,
                },
                timesfmProjection: {
                    direction: features.timesfmDirection,
                    deltaPct: features.timesfmDeltaPct,
                    confidence: features.timesfmConfidence,
                },
            };

            const answers = await callJevSystemOneApi(state, apiKey);
            if (answers) {
                const trendAns = answers.trend_direction;
                const enterAns = answers.should_enter;
                const actionAns = answers.trade_action;
                const riskAns = answers.risk_rating;

                const trendProbs = trendAns?.probabilities || {
                    bullish: trendAns?.choice === "bullish" ? 0.8 : 0.1,
                    sideways: trendAns?.choice === "sideways" ? 0.8 : 0.1,
                    bearish: trendAns?.choice === "bearish" ? 0.8 : 0.1,
                };

                const actionProbs = actionAns?.probabilities || {
                    BUY: actionAns?.choice === "BUY" ? 0.8 : 0.1,
                    WAIT: actionAns?.choice === "WAIT" ? 0.8 : 0.1,
                    SELL: actionAns?.choice === "SELL" ? 0.8 : 0.1,
                };

                const riskScoreVal = typeof riskAns?.score === "number" ? riskAns.score : 1;
                const riskLevel = riskScoreVal < 0.7 ? "Low" : riskScoreVal < 1.5 ? "Moderate" : "High";

                const isTypeSafe = resolveApiEndpoint(apiKey).includes("typesafe.ai");

                return {
                    trendProbabilities: {
                        bullish: Number(trendProbs.bullish ?? 0),
                        sideways: Number(trendProbs.sideways ?? 0),
                        bearish: Number(trendProbs.bearish ?? 0),
                    },
                    action: String(actionAns?.choice || "WAIT").toUpperCase(),
                    actionConfidence: Number(actionAns?.confidence ?? 0.8),
                    actionProbabilities: {
                        BUY: Number(actionProbs.BUY ?? 0),
                        WAIT: Number(actionProbs.WAIT ?? 0),
                        SELL: Number(actionProbs.SELL ?? 0),
                    },
                    shouldEnterScore: Number(enterAns?.noul ?? 0.5),
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
