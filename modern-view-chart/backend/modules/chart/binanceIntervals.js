// Binance-only timeframe adapter.
// Keep application/MT5 timeframe IDs out of Binance API calls. Other market sources
// must own their own mapping contracts.
const BINANCE_NATIVE_INTERVALS = {
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
    '1mo': '1M',
};

const BINANCE_DERIVED_INTERVALS = {
    '10': { upstream: '5m', aggregate: '10m', factor: 2 },
    '10m': { upstream: '5m', aggregate: '10m', factor: 2 },
    '525600': { upstream: '1M', aggregate: '1Y', factor: 12 },
    'Y': { upstream: '1M', aggregate: '1Y', factor: 12 },
    '1Y': { upstream: '1M', aggregate: '1Y', factor: 12 },
    'Y1': { upstream: '1M', aggregate: '1Y', factor: 12 },
};

export function resolveBinanceInterval(interval) {
    const raw = String(interval || '').trim();
    const derived = BINANCE_DERIVED_INTERVALS[raw] || BINANCE_DERIVED_INTERVALS[raw.toUpperCase()];
    if (derived) {
        return {
            requested: raw || '1',
            upstream: derived.upstream,
            aggregate: derived.aggregate,
            factor: derived.factor,
        };
    }

    const upstream = BINANCE_NATIVE_INTERVALS[raw]
        || BINANCE_NATIVE_INTERVALS[raw.toUpperCase()]
        || (/^(1s|1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w|1M)$/.test(raw) ? raw : '1m');

    return {
        requested: raw || '1',
        upstream,
        aggregate: null,
        factor: 1,
    };
}

export function toBinanceInterval(interval) {
    return resolveBinanceInterval(interval).upstream;
}

export function getBinanceUpstreamLimit(interval, requestedLimit) {
    const plan = resolveBinanceInterval(interval);
    const limit = Math.max(1, Math.min(1000, Number.parseInt(String(requestedLimit || 500), 10) || 500));
    return Math.min(1000, Math.max(1, limit * plan.factor));
}
