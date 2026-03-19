import { INDICATOR_REGISTRY, type IndicatorParamSchema } from '@/features/chart/indicators/registry/indicator-definitions';
import type { IndicatorType } from './types';

export interface StrategyIndicatorOption {
    value: IndicatorType;
    label: string;
    defaultParams: number[];
    editableParamCount: number;
}

const PRIORITY_ORDER = [
    'RSI',
    'EMA',
    'SMA',
    'MACD',
    'HMA',
    'ATR',
    'BollingerBands',
    'Stochastic',
    'SuperTrend',
    'VWAP',
    'Ichimoku',
    'ADX',
    'SAR',
    'MarketStructure',
    'TrendLines',
    'Fibonacci',
    'FibonacciExtension',
    'BreakoutRays',
    'OrderBlock',
    'FVG',
] as const;

const collectNumericDefaults = (type: string): number[] => {
    const params = INDICATOR_REGISTRY[type]?.params as Record<string, IndicatorParamSchema> | undefined;
    if (!params) return [];
    return Object.values(params)
        .filter((schema) => schema.type === 'number' && typeof schema.default === 'number')
        .map((schema) => schema.default as number);
};

const registryOptions: StrategyIndicatorOption[] = PRIORITY_ORDER
    .filter((type) => Boolean(INDICATOR_REGISTRY[type]))
    .map((type) => {
        const metadata = INDICATOR_REGISTRY[type];
        const defaultParams = collectNumericDefaults(type);
        return {
            value: type,
            label: metadata?.name || type,
            defaultParams,
            editableParamCount: Math.min(defaultParams.length, 4),
        };
    });

const extraOptions: StrategyIndicatorOption[] = [
    { value: 'Price' as IndicatorType, label: 'Price', defaultParams: [], editableParamCount: 0 },
    { value: 'HA', label: 'Heikin Ashi', defaultParams: [], editableParamCount: 0 },
    { value: 'SIGNALS', label: 'Signals', defaultParams: [14], editableParamCount: 0 },
];

export const STRATEGY_INDICATOR_OPTIONS: StrategyIndicatorOption[] = [...registryOptions, ...extraOptions];

export function getDefaultParamsForIndicator(type: string): number[] {
    const found = STRATEGY_INDICATOR_OPTIONS.find((item) => item.value === type);
    return found?.defaultParams.length ? [...found.defaultParams] : [14];
}

export function getEditableParamCount(type: string): number {
    const found = STRATEGY_INDICATOR_OPTIONS.find((item) => item.value === type);
    if (!found) return 1;
    return Math.max(0, found.editableParamCount || 0);
}
