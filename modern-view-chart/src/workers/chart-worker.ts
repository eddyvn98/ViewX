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
