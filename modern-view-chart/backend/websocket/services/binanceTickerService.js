import WebSocket from 'ws';

let binancePrices = {};
let ws = null;

export function startBinanceTickerStream() {
    if (ws) return;

    const url = 'wss://stream.binance.com:9443/ws/!ticker@arr';
    console.log('🔌 Starting Binance Global Ticker Stream...');

    ws = new WebSocket(url);

    ws.on('message', (data) => {
        try {
            const tickers = JSON.parse(data);
            if (Array.isArray(tickers)) {
                tickers.forEach(t => {
                    // We only care about USDT pairs for our app
                    if (t.s.endsWith('USDT')) {
                        binancePrices[t.s] = {
                            symbol: t.s,
                            price: parseFloat(t.c),
                            change: parseFloat(t.P),
                            changeValue: parseFloat(t.p),
                            source: 'BINANCE',
                            volume: parseFloat(t.v)
                        };
                    }
                });
            }
        } catch (err) {
            console.error('❌ Binance Ticker Stream Error:', err.message);
        }
    });

    ws.on('close', () => {
        console.log('❌ Binance Global Ticker Stream Closed. Reconnecting...');
        ws = null;
        setTimeout(startBinanceTickerStream, 5000);
    });

    ws.on('error', (err) => {
        console.error('❌ Binance Ticker Stream Socket Error:', err.message);
    });
}

export function getBinancePrices(symbols = null) {
    if (!Array.isArray(symbols)) {
        return Object.values(binancePrices);
    }

    const unique = Array.from(new Set(
        symbols
            .map((symbol) => String(symbol || "").trim().toUpperCase())
            .filter((symbol) => symbol.endsWith("USDT"))
    ));

    return unique
        .map((symbol) => binancePrices[symbol])
        .filter(Boolean);
}
