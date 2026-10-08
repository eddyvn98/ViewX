const BINANCE_INTERVALS = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '120': '2h',
    '240': '4h',
    '1440': '1d',
    'D': '1d',
    '1D': '1d',
    'D1': '1d',
    '10080': '1w',
    'W': '1w',
    '1W': '1w',
    'W1': '1w',
    '43200': '1M',
    'M': '1M',
    '1M': '1M',
    'MN1': '1M',
    '525600': '1M',
    'Y': '1M',
    '1Y': '1M',
    'Y1': '1M',
};

export function toBinanceInterval(interval) {
    const raw = String(interval || '').trim();
    if (!raw) return '1m';
    return BINANCE_INTERVALS[raw] || BINANCE_INTERVALS[raw.toUpperCase()] || raw;
}
