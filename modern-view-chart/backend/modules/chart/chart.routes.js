import { Router } from 'express';
import { getBinanceUpstreamLimit, resolveBinanceInterval } from './binanceIntervals.js';
import { aggregateBinanceCandles } from './binanceCandleAggregation.js';

const router = new Router();

function normalizeKline(row) {
    if (!Array.isArray(row) || row.length < 6) return null;
    const time = Math.floor(Number(row[0]) / 1000);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    if (![time, open, high, low, close, volume].every(Number.isFinite)) return null;
    return { time, open, high, low, close, volume };
}

router.route('/data').post(async (req, res) => {
    const symbol = String(req.body?.symbol || '').trim().toUpperCase();
    const requestedInterval = String(req.body?.interval || '1').trim();
    const limit = Math.max(50, Math.min(1000, Number.parseInt(String(req.body?.limit || '500'), 10) || 500));

    if (!/^[A-Z0-9]{5,24}$/.test(symbol)) {
        return res.status(400).json({ error: 'Invalid symbol' });
    }

    const intervalPlan = resolveBinanceInterval(requestedInterval);
    const binanceInterval = intervalPlan.upstream;
    const upstreamLimit = getBinanceUpstreamLimit(requestedInterval, limit);
    const url = new URL('https://api.binance.com/api/v3/klines');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', binanceInterval);
    url.searchParams.set('limit', String(upstreamLimit));

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
        if (!response.ok) {
            return res.status(502).json({ error: 'Binance history unavailable', status: response.status });
        }

        const payload = await response.json();
        const normalizedCandles = (Array.isArray(payload) ? payload : [])
            .map(normalizeKline)
            .filter(Boolean);
        const candles = aggregateBinanceCandles(normalizedCandles, requestedInterval).slice(-limit);

        return res.json({
            source: 'BINANCE',
            symbol,
            interval: requestedInterval,
            binanceInterval,
            derivedInterval: intervalPlan.aggregate,
            candles,
        });
    } catch (error) {
        return res.status(502).json({
            error: 'Binance history unavailable',
            detail: error instanceof Error ? error.message : 'upstream_fetch_failed',
        });
    }
});

router.route('/prices').get(async (_req, res) => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'XRPUSDT'];

    try {
        const prices = await Promise.all(symbols.map(async (symbol) => {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
                signal: AbortSignal.timeout(3500),
            });
            if (!response.ok) throw new Error(`Binance ticker HTTP ${response.status}`);
            return response.json();
        }));

        return res.json(prices.map((item) => ({
            symbol: item.symbol,
            price: Number(item.lastPrice),
            change: Number(item.priceChangePercent),
        })));
    } catch (error) {
        return res.status(502).json({
            error: 'Error fetching market data',
            detail: error instanceof Error ? error.message : 'upstream_fetch_failed',
        });
    }
});

export default router;
