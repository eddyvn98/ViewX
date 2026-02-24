import { BacktestEngine } from '@/features/strategy/logic/backtest/BacktestEngine';
import { IndicatorCalculator } from '@/features/strategy/logic/IndicatorCalculator';
import { calculateMACD } from '@/features/chart/utils/indicator-math';

self.onmessage = async (event: MessageEvent) => {
    const { id, type, payload } = event.data;

    try {
        let result;
        switch (type) {
            case 'RUN_BACKTEST':
                const { strategy, candles, initialBalance, overrideSymbol } = payload;
                result = BacktestEngine.run(strategy, candles, initialBalance, overrideSymbol);
                break;

            case 'CALCULATE_INDICATORS':
                const { indicator, candles: indicatorCandles } = payload;
                result = IndicatorCalculator.getValues(indicator, indicatorCandles);
                break;

            case 'CALCULATE_BATCH':
                const { indicators, candles: batchCandles } = payload;
                result = indicators.map((ind: any) => {
                    // Normalize params for IndicatorCalculator (it expects array, but chart store uses object)
                    const normalizedInd = { ...ind };
                    if (ind.params && typeof ind.params === 'object' && !Array.isArray(ind.params)) {
                        normalizedInd.params = Object.values(ind.params);
                    }
                    if (ind.type === 'MACD' && !ind.field) {
                        const { fast = 12, slow = 26, signal = 9 } = normalizedInd.params;
                        const prices = batchCandles.map((c: any) => c.close);
                        return {
                            id: ind.id,
                            values: calculateMACD(prices, fast, slow, signal)
                        };
                    }
                    if (ind.type === 'BollingerBands' || ind.type === 'BOLLINGER_BANDS') {
                        const { period = 20, stdDev = 2 } = ind.params;
                        const prices = batchCandles.map((c: any) => c.close);
                        const { calculateBollingerBands } = require('../features/chart/utils/indicators/bollinger-bands');
                        return {
                            id: ind.id,
                            values: calculateBollingerBands(prices, period, stdDev)
                        };
                    }
                    if (ind.type === 'Stochastic' || ind.type === 'STOCHASTIC') {
                        const { periodK = 14, smoothK = 3, periodD = 3 } = ind.params;
                        const high = batchCandles.map((c: any) => c.high);
                        const low = batchCandles.map((c: any) => c.low);
                        const close = batchCandles.map((c: any) => c.close);
                        const { calculateStochastic } = require('../features/chart/utils/indicators/stochastic');
                        return {
                            id: ind.id,
                            values: calculateStochastic(high, low, close, periodK, smoothK, periodD)
                        };
                    }
                    if (ind.type === 'SuperTrend' || ind.type === 'SUPERTREND') {
                        const { period = 10, multiplier = 3 } = ind.params;
                        const { calculateSuperTrend } = require('../features/chart/utils/indicators/supertrend');
                        return {
                            id: ind.id,
                            values: calculateSuperTrend(batchCandles, period, multiplier)
                        };
                    }
                    if (ind.type === 'VWAP') {
                        const { calculateVWAP } = require('../features/chart/utils/indicators/vwap');
                        return {
                            id: ind.id,
                            values: calculateVWAP(batchCandles)
                        };
                    }
                    if (ind.type === 'Ichimoku' || ind.type === 'ICHIMOKU') {
                        const { tenkan = 9, kijun = 26, spanB = 52, displacement = 26 } = ind.params;
                        const { calculateIchimoku } = require('../features/chart/utils/indicators/ichimoku');
                        return {
                            id: ind.id,
                            values: calculateIchimoku(batchCandles, tenkan, kijun, spanB, displacement)
                        };
                    }
                    if (ind.type === 'ADX') {
                        const { period = 14 } = ind.params;
                        const { calculateADX } = require('../features/chart/utils/indicators/adx');
                        return {
                            id: ind.id,
                            values: calculateADX(batchCandles, period)
                        };
                    }
                    if (ind.type === 'OrderBlock') {
                        const { depth = 5 } = ind.params;
                        const { calculateOrderBlocks } = require('../features/chart/utils/indicators/smc');
                        return {
                            id: ind.id,
                            values: calculateOrderBlocks(batchCandles, depth)
                        };
                    }
                    if (ind.type === 'FVG') {
                        const { calculateFVG } = require('../features/chart/utils/indicators/smc');
                        return {
                            id: ind.id,
                            values: calculateFVG(batchCandles)
                        };
                    }
                    if (ind.type === 'SAR') {
                        const { startAF = 0.02, incrementAF = 0.02, maxAF = 0.2 } = ind.params;
                        const { calculateSAR } = require('../features/chart/utils/indicators/sar');
                        return {
                            id: ind.id,
                            values: calculateSAR(batchCandles, startAF, incrementAF, maxAF)
                        };
                    }
                    return {
                        id: ind.id,
                        values: IndicatorCalculator.getValues(normalizedInd, batchCandles)
                    };
                });
                break;

            default:
                throw new Error(`Unknown job type: ${type}`);
        }

        self.postMessage({ id, success: true, data: result });
    } catch (error: any) {
        console.error(`[Worker] Error in job ${type}:`, error);
        self.postMessage({ id, success: false, error: error.message });
    }
};
