import assert from 'node:assert/strict';
import test from 'node:test';
import { extractMarketFeatures, evaluateLocally, evaluateMarketProbability } from './jevService.js';

delete process.env.TYPESAFE_API_KEY;
delete process.env.JEV_AI_API_KEY;
delete process.env.JEV_API_ENDPOINT;

// Generate synthetic candles with realistic oscillating wave progression
function generateTrendingCandles(trend = 'up', count = 40) {
    const candles = [];
    let price = 2000;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < count; i++) {
        const isPullback = i % 2 === 0;
        const delta = trend === 'up'
            ? (isPullback ? -1.2 : 2.0)
            : trend === 'down'
            ? (isPullback ? 1.2 : -2.0)
            : (isPullback ? 0.8 : -0.8);

        price += delta;
        candles.push({
            time: now - (count - i) * 900,
            open: price - (delta > 0 ? 1 : -1),
            high: price + 1.5,
            low: price - 1.5,
            close: price,
            volume: 100 + i * 5,
        });
    }
    return candles;
}

test('extractMarketFeatures extracts indicators and returns valid structure', () => {
    const candles = generateTrendingCandles('up', 40);
    const features = extractMarketFeatures(candles, { direction: 'bullish', confidence: 80, delta_pct: 1.5 });

    assert.ok(features.currentPrice > 2000, 'Current price should be above 2000');
    assert.equal(features.timesfmDirection, 'bullish');
    assert.equal(features.timesfmConfidence, 80);
    assert.ok(features.rsi > 0 && features.rsi <= 100, 'RSI should be between 0 and 100');
    assert.ok(['bullish', 'strong_bullish'].includes(features.emaTrend), `Expected bullish EMA trend, got: ${features.emaTrend}`);
});

test('evaluateLocally returns valid normalized probabilities and trade action', () => {
    const candles = generateTrendingCandles('up', 40);
    const features = extractMarketFeatures(candles, { direction: 'bullish', confidence: 85, delta_pct: 1.2 });
    const result = evaluateLocally(features);

    // Verify trend probabilities sum close to 1
    const { bullish, sideways, bearish } = result.trendProbabilities;
    assert.ok(bullish >= 0 && bullish <= 1, 'Bullish prob in [0, 1]');
    assert.ok(bearish >= 0 && bearish <= 1, 'Bearish prob in [0, 1]');
    assert.ok(sideways >= 0 && sideways <= 1, 'Sideways prob in [0, 1]');
    assert.ok(Math.abs(bullish + sideways + bearish - 1.0) < 0.05, 'Sum of trend probabilities must be approx 1.0');

    // In a strong uptrend with bullish TimesFM, bullish should dominate
    assert.ok(bullish > bearish, `Bullish (${bullish}) should exceed bearish (${bearish})`);
    assert.equal(result.action, 'BUY', `Action should be BUY, got ${result.action}`);
    assert.ok(result.shouldEnterScore >= 0.5, 'Should enter score should be favorable');
    assert.ok(['Low', 'Moderate', 'High'].includes(result.riskLevel), 'Risk level should be categorized');
});

test('evaluateMarketProbability executes without crashing when no API key provided', async () => {
    const candles = generateTrendingCandles('down', 40);
    const result = await evaluateMarketProbability({
        symbol: 'BTCUSD',
        timeframe: '15m',
        candles,
        timesfmResult: { direction: 'bearish', confidence: 85, delta_pct: -1.2 },
    });

    assert.ok(result, 'Result should exist');
    assert.ok(result.trendProbabilities, 'Trend probabilities must exist');
    assert.ok(result.actionProbabilities, 'Action probabilities must exist');
    assert.ok(['BUY', 'SELL', 'WAIT'].includes(result.action), 'Action must be BUY, SELL, or WAIT');
    assert.ok(result.trendProbabilities.bearish > result.trendProbabilities.bullish, 'Bearish prob should exceed bullish');
    assert.equal(result.action, 'SELL', 'Action should recommend SELL for downtrend');
});

test('evaluateMarketProbability evaluates independently without timesfmResult', async () => {
    // Uptrend without any timesfmResult
    const upCandles = generateTrendingCandles('up', 40);
    const upResult = await evaluateMarketProbability({
        symbol: 'XAUUSD',
        timeframe: '15m',
        candles: upCandles,
    });
    assert.equal(upResult.action, 'BUY', `Independent uptrend should trigger BUY, got ${upResult.action}`);
    assert.ok(upResult.trendProbabilities.bullish > upResult.trendProbabilities.bearish);

    // Downtrend without any timesfmResult
    const downCandles = generateTrendingCandles('down', 40);
    const downResult = await evaluateMarketProbability({
        symbol: 'XAUUSD',
        timeframe: '15m',
        candles: downCandles,
    });
    assert.equal(downResult.action, 'SELL', `Independent downtrend should trigger SELL, got ${downResult.action}`);
    assert.ok(downResult.trendProbabilities.bearish > downResult.trendProbabilities.bullish);

    // Sideways market should recommend WAIT
    const flatCandles = generateTrendingCandles('flat', 40);
    const flatResult = await evaluateMarketProbability({
        symbol: 'XAUUSD',
        timeframe: '15m',
        candles: flatCandles,
    });
    assert.equal(flatResult.action, 'WAIT', `Independent sideways market should trigger WAIT, got ${flatResult.action}`);
});


test('reversal candles do not preserve stale trend entries', async () => {
    const bullishThenCrash = generateTrendingCandles('up', 40);
    const lastBullish = bullishThenCrash[bullishThenCrash.length - 1];
    bullishThenCrash.push({
        ...lastBullish,
        time: lastBullish.time + 900,
        open: lastBullish.close,
        high: lastBullish.close + 1,
        low: lastBullish.close - 45,
        close: lastBullish.close - 40,
    });

    const crashFeatures = extractMarketFeatures(bullishThenCrash);
    const crashResult = await evaluateMarketProbability({
        symbol: 'XAUUSD',
        timeframe: '15m',
        candles: bullishThenCrash,
    });

    assert.ok(
        !['strong_bullish', 'pullback_bullish', 'bullish'].includes(crashFeatures.emaTrend),
        `A sharp bearish reversal must invalidate bullish EMA state, got ${crashFeatures.emaTrend}`,
    );
    assert.equal(crashResult.action, 'WAIT', 'A bearish reversal must not keep a stale BUY');

    const bearishThenRebound = generateTrendingCandles('down', 40);
    const lastBearish = bearishThenRebound[bearishThenRebound.length - 1];
    bearishThenRebound.push({
        ...lastBearish,
        time: lastBearish.time + 900,
        open: lastBearish.close,
        high: lastBearish.close + 45,
        low: lastBearish.close - 1,
        close: lastBearish.close + 40,
    });

    const reboundFeatures = extractMarketFeatures(bearishThenRebound);
    const reboundResult = await evaluateMarketProbability({
        symbol: 'XAUUSD',
        timeframe: '15m',
        candles: bearishThenRebound,
    });

    assert.ok(
        !['strong_bearish', 'pullback_bearish', 'bearish'].includes(reboundFeatures.emaTrend),
        `A sharp bullish reversal must invalidate bearish EMA state, got ${reboundFeatures.emaTrend}`,
    );
    assert.equal(reboundResult.action, 'WAIT', 'A bullish reversal must not keep a stale SELL');
});

test('cloud risk score is normalized to the UI 0..1 contract', async () => {
    const originalFetch = globalThis.fetch;
    process.env.JEV_AI_API_KEY = 'test-key';
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            answers: {
                trend_direction: {
                    choice: 'bullish',
                    probabilities: { bullish: 0.7, sideways: 0.2, bearish: 0.1 },
                },
                should_enter: { noul: 0.7 },
                trade_action: {
                    choice: 'BUY',
                    confidence: 0.8,
                    probabilities: { BUY: 0.8, WAIT: 0.1, SELL: 0.1 },
                },
                risk_rating: { score: 2 },
            },
        }),
    });

    try {
        const candles = generateTrendingCandles('up', 40);
        const result = await evaluateMarketProbability({
            symbol: 'XAUUSD',
            timeframe: '15m',
            candles,
        });
        assert.equal(result.riskLevel, 'High');
        assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
    } finally {
        globalThis.fetch = originalFetch;
        delete process.env.JEV_AI_API_KEY;
    }
});
