export const SMART_ANALYSIS_TYPES = [
    'MarketStructure',
    'BREAKOUT_RAYS',
    'BreakoutRays',
    'TREND_LINES',
    'TrendLines',
    'FIBONACCI',
    'Fibonacci',
    'OrderBlock',
    'FVG',
    'MARKET_STRUCTURE'
];

export const isSmartAnalysis = (type: string) => SMART_ANALYSIS_TYPES.includes(type);
