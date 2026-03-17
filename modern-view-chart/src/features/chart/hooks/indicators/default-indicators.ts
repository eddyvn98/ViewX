import type { IndicatorConfig } from '@/lib/store/types';

export const DEFAULT_CHART_INDICATORS: Array<Omit<IndicatorConfig, 'id'>> = [
    { type: 'EMA', params: { period: 25 }, color: '#9c27b0', visible: true, lineWidth: 1, pane: 'main' },
    { type: 'HMA', params: { period: 25 }, color: '#00bcd4', visible: true, lineWidth: 2, pane: 'main' },
    { type: 'RSI', params: { period: 14 }, color: '#f06292', visible: true, lineWidth: 2, pane: 'subchart' },
    { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, color: '#2962FF', visible: false, lineWidth: 1, pane: 'subchart' },
    { type: 'MARKET_STRUCTURE', params: { depth: 7 }, color: '#ffffff', visible: true, lineWidth: 1, pane: 'main' },
    { type: 'BREAKOUT_RAYS', params: {}, color: '#ffffff', visible: true, lineWidth: 1, pane: 'main' },
    { type: 'TREND_LINES', params: {}, color: '#ffffff', visible: true, lineWidth: 1, pane: 'main' },
    {
        type: 'FIBONACCI',
        params: { depth: 7, showPercent: true, showPrice: true, levels: { '0': true, '0.236': true, '0.382': false, '0.5': true, '0.618': true, '0.786': false, '1.0': true } },
        color: '#ffffff',
        visible: false,
        lineWidth: 1,
        pane: 'main',
    },
    {
        type: 'FIBONACCI_EXTENSION',
        params: {
            depth: 7,
            showPercent: true,
            showPrice: true,
            levels: { '0': true, '0.236': true, '0.382': true, '0.5': true, '0.618': true, '0.786': true, '1.0': true, '1.618': true, '2.618': true },
        },
        color: '#ffffff',
        visible: false,
        lineWidth: 1,
        pane: 'main',
    },
];
