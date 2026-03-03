
import fetch from "node-fetch";

async function testBinanceHistory() {
    const symbol = 'BTCUSDT';
    const interval = '1m';
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=10`;

    console.log(`Fetching history from ${url}...`);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error('❌ HTTP Error:', res.status, res.statusText);
            process.exit(1);
        }

        const data = await res.json();
        console.log(`✅ Received ${data.length} historical candles.`);
        if (data.length > 0) {
            console.log('Last candle close:', data[data.length - 1][4]);
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fetching Binance history:', err.message);
        process.exit(1);
    }
}

testBinanceHistory();
