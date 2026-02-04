import { WebSocket } from 'ws';

const ws = new WebSocket('ws://127.0.0.1:8090');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    ws.send(JSON.stringify({ type: 'auth', userId: 'tester' }));
    setTimeout(() => ws.close(), 1000);
});

ws.on('error', (err) => {
    console.error('❌ Connection failed:', err.message);
});

ws.on('close', () => {
    console.log('🔌 Disconnected');
});
