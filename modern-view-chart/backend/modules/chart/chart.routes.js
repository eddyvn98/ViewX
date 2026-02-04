import { Router } from 'express';
const router = new Router();

router.route("/data").post(async (req, res) => {
    const { symbol, interval } = req.body;

    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.route("/prices").get(async (req, res) => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'XRPUSDT'];

    try {
        const promises = symbols.map(sym =>
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`)
                .then(response => response.json())
        );

        const prices = await Promise.all(promises);

        const result = prices.map(r => ({
            symbol: r.symbol,
            price: parseFloat(r.lastPrice).toFixed(4),
            change: parseFloat(r.priceChangePercent).toFixed(2)
          }));

        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Error fetching market data' });
    }
});

export default router;