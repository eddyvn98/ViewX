export const SMART_ANALYSIS_TYPES = [
    'MARKET_STRUCTURE',
    'BREAKOUT_RAYS',
    'TREND_LINES',
    'FIBONACCI',
    'FIBONACCI_EXTENSION',
    'MarketStructure',
    'BreakoutRays',
    'TrendLines',
];

export function isSmartAnalysisIndicator(type: string): boolean {
    return SMART_ANALYSIS_TYPES.includes(type);
}
