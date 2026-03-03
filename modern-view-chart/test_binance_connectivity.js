
import WebSocket from 'ws';

const url = 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m';
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('✅ Connection opened successfully!');
    setTimeout(() => {
        console.log('Closing connection...');
        ws.terminate();
        process.exit(0);
    }, 5000);
});

ws.on('message', (data) => {
    console.log('📩 Received message:', data.toString().substring(0, 100) + '...');
});

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('❌ Connection closed');
});
