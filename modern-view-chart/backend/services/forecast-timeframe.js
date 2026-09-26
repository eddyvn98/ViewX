const TIMEFRAME_LABELS = new Map([
    ['1', '1m'], ['1m', '1m'], ['m1', '1m'],
    ['5', '5m'], ['5m', '5m'], ['m5', '5m'],
    ['15', '15m'], ['15m', '15m'], ['m15', '15m'],
    ['30', '30m'], ['30m', '30m'], ['m30', '30m'],
    ['60', '1H'], ['1h', '1H'], ['h1', '1H'],
    ['120', '2H'], ['2h', '2H'], ['h2', '2H'],
    ['240', '4H'], ['4h', '4H'], ['h4', '4H'],
    ['1440', 'D'], ['1d', 'D'], ['d', 'D'], ['d1', 'D'],
    ['10080', 'W'], ['1w', 'W'], ['w', 'W'], ['w1', 'W'],
    ['43200', '1M'], ['1mo', '1M'], ['mn1', '1M'],
]);

export function formatForecastTimeframe(timeframe) {
    const raw = String(timeframe || '').trim();
    if (!raw) return '';
    return TIMEFRAME_LABELS.get(raw.toLowerCase()) || raw;
}
