
import WebSocket from 'ws';

const url = 'wss://stream.binance.com:9443/ws/!ticker@arr';
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);
let count = 0;

ws.on('open', () => {
    console.log('✅ Global Ticker Stream opened successfully!');
});

ws.on('message', (data) => {
    count++;
    if (count === 1) {
        const tickers = JSON.parse(data);
        console.log(`📩 Received ${tickers.length} tickers in first batch.`);
        const btc = tickers.find(t => t.s === 'BTCUSDT');
        if (btc) {
            console.log('BTCUSDT Price:', btc.c);
        }
        console.log('Test successful. Closing...');
        ws.terminate();
        process.exit(0);
    }
});

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('❌ Connection closed');
});

setTimeout(() => {
    console.log('Timeout waiting for tickers...');
    ws.terminate();
    process.exit(1);
}, 10000);
