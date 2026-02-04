import { useEffect, useCallback } from 'react';
import { useMarketStore } from '@/lib/store';

const SOCKET_URL = 'ws://127.0.0.1:8091';

// SINGLETON: Store socket outside the hook to share between components
let globalSocket: WebSocket | null = null;
let historyFetched = false;

// Throttle ticker updates to reduce re-renders (batch updates every 500ms)
let tickerUpdateBuffer: Record<string, any> = {};
let tickerUpdateTimer: NodeJS.Timeout | null = null;

export function useWebSocket(): { sendMessage: (data: any) => void } {
    const setConnected = useMarketStore((state) => state.setConnected);
    const setBridgeOnline = useMarketStore((state) => state.setBridgeOnline);
    const updateTicker = useMarketStore((state) => state.updateTicker);
    const updateTickers = useMarketStore((state) => state.updateTickers);
    const setCandles = useMarketStore((state) => state.setCandles);
    const updateLastCandle = useMarketStore((state) => state.updateLastCandle);
    const setAccount = useMarketStore((state) => state.setAccount);
    const setPositions = useMarketStore((state) => state.setPositions);
    const setOrders = useMarketStore((state) => state.setOrders);
    const appendHistory = useMarketStore((state) => state.appendHistory);
    const setSymbolInfo = useMarketStore((state) => state.setSymbolInfo);
    const isConnected = useMarketStore((state) => state.isConnected);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (globalSocket) return; // Only connect once

        const connect = () => {
            console.log('🔌 Connecting to Global WebSocket:', SOCKET_URL);
            globalSocket = new WebSocket(SOCKET_URL);

            globalSocket.onopen = () => {
                console.log('✅ Global WebSocket Connected');
                setConnected(true);
                const userId = "user_123";
                globalSocket?.send(JSON.stringify({ topic: "auth", userId }));
            };

            globalSocket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    // LỖI 1 FIX: Use topic/event for message classification
                    const msgType = msg.topic || msg.event || msg.type;

                    // 1. Ticker / Price Update - THROTTLED
                    if (msgType === 'priceUpdate' && Array.isArray(msg.data)) {
                        msg.data.forEach((item: any) => {
                            tickerUpdateBuffer[item.symbol] = {
                                symbol: item.symbol,
                                price: item.price,
                                change: item.change,
                                changeValue: item.changeValue,
                                volume: 0,
                                source: item.source
                            };
                        });

                        if (!tickerUpdateTimer) {
                            tickerUpdateTimer = setTimeout(() => {
                                updateTickers(tickerUpdateBuffer);
                                tickerUpdateBuffer = {};
                                tickerUpdateTimer = null;
                            }, 500);
                        }
                    }

                    // Individual/MT5 Price Update
                    if (msgType === 'tick' || msgType === 'mt5_update') {
                        updateTicker(msg.symbol, {
                            symbol: msg.symbol,
                            price: msg.price,
                            change: msg.change || 0,
                            changeValue: msg.changeValue || 0,
                            volume: 0,
                            source: 'MT5'
                        });
                    }

                    // 2. Candle History
                    if (msgType === 'mt5_candles' && Array.isArray(msg.candles)) {
                        const targetSymbol = msg.symbol;
                        const targetInterval = msg.interval;
                        if (targetSymbol && targetInterval) {
                            const source = msg.source || 'MT5';
                            setCandles(source, targetSymbol, targetInterval, msg.candles);
                        }
                    }

                    // 3. Realtime Candle Update
                    if (msgType === 'candleUpdate' && msg.data) {
                        const c = msg.data;
                        const source = c.symbol.toUpperCase().includes('USDT') ? 'BINANCE' : 'MT5';
                        updateLastCandle(source, c.symbol, c.interval, c);
                    }

                    // 4. Bridge Status
                    if (msgType === 'bridgeStatus') {
                        setBridgeOnline(msg.online);
                        // FIX 3: Retry history fetch if bridge comes online
                        if (msg.online) {
                            historyFetched = false;
                        }
                    }

                    // 5. Account & Positions Update
                    if (msgType === 'mt5_positions_update') {
                        if (msg.account) {
                            setAccount('MT5', {
                                balance: Number(msg.account.balance) || 0,
                                equity: Number(msg.account.equity) || 0,
                                margin: Number(msg.account.margin) || 0,
                                free_margin: Number(msg.account.free_margin) || 0,
                                margin_level: Number(msg.account.margin_level) || 0,
                                profit: Number(msg.account.profit) || 0
                            });
                        }
                        if (msg.positions && Array.isArray(msg.positions)) {
                            const mappedPositions = msg.positions.map((p: any) => ({
                                ticket: p.ticket,
                                symbol: p.symbol,
                                type: p.type || 'buy', // This is deal type, doesn't collide with msgType
                                volume: p.volume || 0,
                                open_price: p.price_open || 0,
                                current_price: p.price_current || 0,
                                sl: p.sl || 0,
                                tp: p.tp || 0,
                                profit: p.profit || 0,
                                time: p.time,
                                magic: p.magic || 0,
                                source: 'MT5'
                            }));
                            setPositions(mappedPositions);
                        }
                        if (msg.orders && Array.isArray(msg.orders)) {
                            const mappedOrders = msg.orders.map((o: any) => ({
                                ticket: o.ticket,
                                symbol: o.symbol,
                                type: o.type,
                                volume: o.volume,
                                price_open: o.price_open,
                                current_price: o.price_current,
                                sl: o.sl,
                                tp: o.tp,
                                profit: o.profit || 0,
                                time: o.time,
                                magic: o.magic || 0,
                                source: 'MT5'
                            }));
                            setOrders(mappedOrders);
                        }
                    }

                    if (msgType === 'optimization_result') {
                        const result = msg.data;
                        console.log("🧪 [WS] Optimization Result:", result);
                        const setOptimizationResult = useMarketStore.getState().setOptimizationResult;
                        if (setOptimizationResult) {
                            setOptimizationResult(result);
                        }
                    }

                    // 5b. BINANCE Account & Positions Update
                    if (msgType === 'binance_positions_update') {
                        if (msg.account) {
                            setAccount('BINANCE_DEMO', msg.account);
                        }
                        if (msg.positions && Array.isArray(msg.positions)) {
                            const mapped = msg.positions.map((p: any) => ({ ...p, source: 'BINANCE_DEMO' }));
                            setPositions(mapped);
                        }
                        if (msg.history && Array.isArray(msg.history)) {
                            const mapped = msg.history.map((h: any) => ({ ...h, source: 'BINANCE_DEMO' }));
                            appendHistory(mapped, true); // Replace for demo
                        }
                    }

                    if (msgType === 'binance_order_result') {
                        if (msg.status === 'success') {
                            useMarketStore.getState().addNotification(
                                `Binance Order Success: ${msg.message || 'Trade executed'}`,
                                'success'
                            );
                        } else {
                            useMarketStore.getState().addNotification(
                                `Binance Order Failed: ${msg.message}`,
                                'error'
                            );
                        }
                    }

                    // 6. History Deals (LỖI 3 FIX: Handled in Store via Functional Update)
                    if (msgType === 'mt5_history_deals') {
                        const dealData = Array.isArray(msg.data) ? msg.data : [];
                        const isChunk = msg.is_chunk !== undefined ? msg.is_chunk : false;
                        const chunkIdx = msg.chunk_index !== undefined ? msg.chunk_index : 0;
                        const totalChunks = msg.total_chunks || 1;

                        console.log(`📜 [HISTORY] Received chunk ${chunkIdx + 1}/${totalChunks} (${dealData.length} deals)`);

                        // FIX 2: Reset ONLY on full snapshot (when not using chunks)
                        const isReset = isChunk === false;
                        appendHistory(dealData, isReset);
                    }

                    // 7. Symbol Info
                    if (msgType === 'mt5_symbol_info') {
                        setSymbolInfo(msg.data);
                    }

                    // 8. Alert Triggered
                    if (msgType === 'alert_triggered') {
                        const { alert, message, direction } = msg as any;
                        useMarketStore.getState().updateAlert(alert.id, { active: false, direction });
                        useMarketStore.getState().addNotification(message, direction === 'bullish' ? 'success' : 'warning', alert.id);

                        // Simple Audio Beep
                        try {
                            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                            if (AudioContext) {
                                const ctx = new AudioContext();
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.frequency.setValueAtTime(direction === 'bullish' ? 880 : 660, ctx.currentTime);
                                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                                osc.start();
                                osc.stop(ctx.currentTime + 0.5);
                            }
                        } catch (e) { }
                    }

                    // 9. Strategy Alert
                    if (msgType === 'strategy_alert') {
                        const { signal } = msg;
                        const direction = signal.signal === 'BUY' ? 'bullish' : 'bearish';
                        useMarketStore.getState().addNotification(
                            `STRATEGY: ${signal.signal} ${signal.symbol} - ${signal.params.reason}`,
                            direction === 'bullish' ? 'success' : 'warning'
                        );

                        // Play Sound
                        try {
                            const audio = new Audio('/sounds/alert.mp3'); // Or reuse Context
                            // quick beep reuse
                            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                            if (AudioContext) {
                                const ctx = new AudioContext();
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.frequency.setValueAtTime(direction === 'bullish' ? 1200 : 400, ctx.currentTime);
                                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                                osc.start();
                                osc.stop(ctx.currentTime + 0.3);
                            }
                        } catch (e) { }
                    }
                } catch (err) { }
            };

            globalSocket.onclose = () => {
                console.log('❌ Global WebSocket Disconnected');
                setConnected(false);
                setBridgeOnline(false);
                globalSocket = null;
                historyFetched = false; // Allow re-fetch on reconnect
                setTimeout(connect, 3000);
            };

            globalSocket.onerror = () => {
                globalSocket?.close();
            };
        };

        connect();
    }, [setAccount, setBridgeOnline, setCandles, setConnected, setPositions, updateLastCandle, updateTicker, updateTickers, setOrders, appendHistory, setSymbolInfo]);

    // Secondary Effects: History Fetch & Tab Visibility
    useEffect(() => {
        if (isConnected && globalSocket?.readyState === WebSocket.OPEN) {
            // 1. Initial History Fetch (ONLY ONCE)
            if (!historyFetched) {
                console.log('[HISTORY] Fetching global history...');
                historyFetched = true; // Set BEFORE sending to prevent duplicate requests
                globalSocket.send(JSON.stringify({
                    topic: "mt5_command",
                    command: "get_history",
                    limit: 100
                }));
            }

            // 2. Tab Visibility Recovery
            const handleVisibility = () => {
                if (document.visibilityState === 'visible') {
                    console.log('👀 Tab visible, syncing charts...');
                    const tabs = useMarketStore.getState().tabs;
                    Object.values(tabs).forEach(tab => {
                        Object.values(tab.charts).forEach(chart => {
                            if (chart.source === 'MT5') {
                                globalSocket?.send(JSON.stringify({
                                    topic: "mt5_command",
                                    command: "get_candles",
                                    symbol: chart.symbol,
                                    interval: chart.interval,
                                    count: 300
                                }));
                            }
                        });
                    });
                }
            };
            document.addEventListener('visibilitychange', handleVisibility);
            return () => document.removeEventListener('visibilitychange', handleVisibility);
        }
    }, [isConnected]);

    const sendMessage = useCallback((data: any) => {
        if (globalSocket?.readyState === WebSocket.OPEN) {
            globalSocket.send(JSON.stringify(data));
        }
    }, []);

    return { sendMessage };
}
