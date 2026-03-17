import { calculateMACD } from '@/features/chart/utils/indicator-math';
import { calculateADX } from '@/features/chart/utils/indicators/adx';
import { calculateBollingerBands } from '@/features/chart/utils/indicators/bollinger-bands';
import { calculateIchimoku } from '@/features/chart/utils/indicators/ichimoku';
import { calculateSAR } from '@/features/chart/utils/indicators/sar';
import { calculateFVG, calculateOrderBlocks } from '@/features/chart/utils/indicators/smc';
import { calculateStochastic } from '@/features/chart/utils/indicators/stochastic';
import { calculateSuperTrend } from '@/features/chart/utils/indicators/supertrend';
import { calculateVWAP } from '@/features/chart/utils/indicators/vwap';
import { IndicatorCalculator } from '@/features/strategy/logic/IndicatorCalculator';
import { BacktestEngine } from '@/features/strategy/logic/backtest/BacktestEngine';
import type { Candle, IndicatorConfig } from '@/lib/store/types';
import type { WorkerJob, WorkerResponse } from './worker-client';

type WorkerRequest = {
    id: string;
} & WorkerJob;

type WorkerError = Error & { message: string };

const toNumber = (value: unknown, fallback: number): number => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const toIndicatorParams = (indicator: IndicatorConfig): Record<string, unknown> => {
    const params = indicator.params;
    return params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
};

const mapMacdValues = (candles: Candle[], params: Record<string, unknown>) => {
    const fast = toNumber(params.fast, 12);
    const slow = toNumber(params.slow, 26);
    const signal = toNumber(params.signal, 9);
    const prices = candles.map((candle) => candle.close);
    return calculateMACD(prices, fast, slow, signal);
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { id, type, payload } = event.data;

    try {
        let result: unknown;

        switch (type) {
            case 'RUN_BACKTEST': {
                const { strategy, candles, initialBalance, overrideSymbol, overrideTimeframe, source, matrixScopeKey } = payload;
                result = BacktestEngine.run(strategy, candles, initialBalance, overrideSymbol, undefined, overrideTimeframe, source, matrixScopeKey);
                break;
            }

            case 'CALCULATE_INDICATORS': {
                const { indicator, candles } = payload;
                result = IndicatorCalculator.getValues(
                    indicator as unknown as Parameters<typeof IndicatorCalculator.getValues>[0],
                    candles,
                );
                break;
            }

            case 'CALCULATE_BATCH': {
                const { indicators, candles } = payload;
                result = indicators.map((indicator) => {
                    const params = toIndicatorParams(indicator);

                    if (indicator.type === 'MACD') {
                        return { id: indicator.id, values: mapMacdValues(candles, params) };
                    }

                    if (indicator.type === 'BollingerBands' || indicator.type === 'BOLLINGER_BANDS') {
                        const period = toNumber(params.period, 20);
                        const stdDev = toNumber(params.stdDev, 2);
                        const prices = candles.map((candle) => candle.close);
                        return { id: indicator.id, values: calculateBollingerBands(prices, period, stdDev) };
                    }

                    if (indicator.type === 'Stochastic' || indicator.type === 'STOCHASTIC') {
                        const periodK = toNumber(params.periodK, 14);
                        const smoothK = toNumber(params.smoothK, 3);
                        const periodD = toNumber(params.periodD, 3);
                        const high = candles.map((candle) => candle.high);
                        const low = candles.map((candle) => candle.low);
                        const close = candles.map((candle) => candle.close);
                        return { id: indicator.id, values: calculateStochastic(high, low, close, periodK, smoothK, periodD) };
                    }

                    if (indicator.type === 'SuperTrend' || indicator.type === 'SUPERTREND') {
                        const period = toNumber(params.period, 10);
                        const multiplier = toNumber(params.multiplier, 3);
                        return { id: indicator.id, values: calculateSuperTrend(candles, period, multiplier) };
                    }

                    if (indicator.type === 'VWAP') {
                        return { id: indicator.id, values: calculateVWAP(candles) };
                    }

                    if (indicator.type === 'Ichimoku' || indicator.type === 'ICHIMOKU') {
                        const tenkan = toNumber(params.tenkan, 9);
                        const kijun = toNumber(params.kijun, 26);
                        const spanB = toNumber(params.spanB, 52);
                        const displacement = toNumber(params.displacement, 26);
                        return { id: indicator.id, values: calculateIchimoku(candles, tenkan, kijun, spanB, displacement) };
                    }

                    if (indicator.type === 'ADX') {
                        const period = toNumber(params.period, 14);
                        return { id: indicator.id, values: calculateADX(candles, period) };
                    }

                    if (indicator.type === 'OrderBlock') {
                        const depth = toNumber(params.depth, 5);
                        return { id: indicator.id, values: calculateOrderBlocks(candles, depth) };
                    }

                    if (indicator.type === 'FVG') {
                        return { id: indicator.id, values: calculateFVG(candles) };
                    }

                    if (indicator.type === 'SAR') {
                        const startAF = toNumber(params.startAF, 0.02);
                        const incrementAF = toNumber(params.incrementAF, 0.02);
                        const maxAF = toNumber(params.maxAF, 0.2);
                        return { id: indicator.id, values: calculateSAR(candles, startAF, incrementAF, maxAF) };
                    }

                    return {
                        id: indicator.id,
                        values: IndicatorCalculator.getValues(
                            indicator as unknown as Parameters<typeof IndicatorCalculator.getValues>[0],
                            candles,
                        ),
                    };
                });
                break;
            }

            default:
                throw new Error(`Unknown job type: ${String(type)}`);
        }

        const response: WorkerResponse = { id, success: true, data: result };
        self.postMessage(response);
    } catch (error) {
        const err = error as WorkerError;
        console.error(`[Worker] Error in job ${type}:`, err);
        const response: WorkerResponse = { id, success: false, error: err.message };
        self.postMessage(response);
    }
};
