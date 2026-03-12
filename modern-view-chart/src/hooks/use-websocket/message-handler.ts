import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { soundService } from '@/features/strategy/logic/SoundService';
import { STRATEGY_ENGINE_ENABLED, CANDLE_BUFFER_MS, POSITION_BUFFER_MS, TICKER_BUFFER_MS } from './constants';
import { wsRuntime } from './runtime';
import { buildActiveSymbolSet } from './symbol-utils';

export interface MessageHandlerDeps {
    updateTickers: (tickers: Record<string, any>) => void;
    setCandles: (source: string, symbol: string, interval: string, data: any[]) => void;
    updateLastCandle: (source: string, symbol: string, interval: string, candle: any) => void;
    setBridgeOnline: (online: boolean) => void;
    setAccount: (source: string, account: any) => void;
    setPositions: (positions: any[]) => void;
    setOrders: (orders: any[]) => void;
    appendHistory: (items: any[], isReset: boolean) => void;
    setSymbolInfo: (info: any) => void;
    setAvailableSymbols: (symbols: string[]) => void;
}

export function handleSocketMessage(event: MessageEvent, socket: WebSocket, deps: MessageHandlerDeps) {
    try {
        const msg = JSON.parse(event.data);
        const msgType = msg.topic || msg.event || msg.type;
        if (msgType === 'error' && String(msg?.code || '').toLowerCase() === 'unauthorized') {
            wsRuntime.unauthorizedFrameReceived = true;
            socket.close(1008, 'Unauthorized');
            return;
        }

        if ((msgType === 'priceUpdate' && Array.isArray(msg.data)) || msgType === 'tick' || msgType === 'mt5_update') {
            const state = useMarketStore.getState();
            const activeSymbols = buildActiveSymbolSet(state);

            const incomingData = msgType === 'priceUpdate' ? msg.data : [msg];
            let usefulUpdate = false;
            incomingData.forEach((item: any) => {
                if (activeSymbols.has(item.symbol)) {
                    wsRuntime.tickerUpdateBuffer[item.symbol] = {
                        symbol: item.symbol,
                        price: item.price,
                        change: item.change || 0,
                        changeValue: item.changeValue || 0,
                        volume: 0,
                        source: item.source || 'MT5',
                        serverTime: item.time,
                    };
                    usefulUpdate = true;
                }
            });

            if (usefulUpdate && !wsRuntime.tickerUpdateTimer) {
                wsRuntime.tickerUpdateTimer = setTimeout(() => {
                    deps.updateTickers(wsRuntime.tickerUpdateBuffer);
                    wsRuntime.tickerUpdateBuffer = {};
                    wsRuntime.tickerUpdateTimer = null;
                }, TICKER_BUFFER_MS);
            }
        }

        if (msgType === 'mt5_candles' && Array.isArray(msg.candles)) {
            const targetSymbol = msg.symbol;
            const targetInterval = msg.interval;
            const normalizedCandles = msg.candles.map((c: any) => ({
                ...c,
                time: c.time ?? c.t ?? c.timestamp ?? c.datetime,
                open: c.open ?? c.o ?? c.open_price ?? c.price_open,
                high: c.high ?? c.h ?? c.high_price ?? c.price_high,
                low: c.low ?? c.l ?? c.low_price ?? c.price_low,
                close: c.close ?? c.c ?? c.close_price ?? c.price_close,
                volume: c.volume ?? c.v ?? c.tick_volume ?? c.real_volume ?? 0,
            }));
            const sample = normalizedCandles[0];
            debugLog('[WS][mt5_candles]', {
                symbol: targetSymbol,
                interval: targetInterval,
                count: normalizedCandles.length,
                source: msg.source,
                sampleTime: sample?.time,
                sampleOpen: sample?.open,
            });
            if (targetSymbol && targetInterval) {
                const source = msg.source || 'MT5';
                deps.setCandles(source, targetSymbol, targetInterval, normalizedCandles);
            }
        }

        if (msgType === 'candleUpdate' && msg.data) {
            const c = msg.data;
            const source = c.symbol.toUpperCase().includes('USDT') ? 'BINANCE' : 'MT5';
            const key = `${source}:${c.symbol}:${c.interval}`;
            wsRuntime.candleUpdateBuffer[key] = { source, symbol: c.symbol, interval: c.interval, candle: c };

            if (!wsRuntime.candleUpdateTimer) {
                wsRuntime.candleUpdateTimer = setTimeout(() => {
                    Object.values(wsRuntime.candleUpdateBuffer).forEach((item: any) => {
                        deps.updateLastCandle(item.source, item.symbol, item.interval, item.candle);
                    });
                    wsRuntime.candleUpdateBuffer = {};
                    wsRuntime.candleUpdateTimer = null;
                }, CANDLE_BUFFER_MS);
            }
        }

        if (msgType === 'bridgeStatus') {
            deps.setBridgeOnline(msg.online);
            if (msg.online) wsRuntime.historyFetched = false;
        }

        if (msgType === 'mt5_positions_update') {
            wsRuntime.positionUpdateBuffer = msg;
            if (!wsRuntime.positionUpdateTimer) {
                wsRuntime.positionUpdateTimer = setTimeout(() => {
                    const data = wsRuntime.positionUpdateBuffer;
                    if (data.account) {
                        deps.setAccount('MT5', {
                            balance: Number(data.account.balance) || 0,
                            equity: Number(data.account.equity) || 0,
                            margin: Number(data.account.margin) || 0,
                            free_margin: Number(data.account.free_margin) || 0,
                            margin_level: Number(data.account.margin_level) || 0,
                            profit: Number(data.account.profit) || 0,
                        });
                    }
                    if (data.positions && Array.isArray(data.positions)) {
                        const mappedPositions = data.positions.map((p: any) => ({
                            ticket: p.ticket,
                            symbol: p.symbol,
                            type: p.type || 'buy',
                            volume: p.volume || 0,
                            open_price: p.price_open || 0,
                            current_price: p.price_current || 0,
                            sl: p.sl || 0,
                            tp: p.tp || 0,
                            profit: p.profit || 0,
                            time: p.time,
                            magic: p.magic || 0,
                            source: 'MT5',
                        }));
                        deps.setPositions(mappedPositions);
                    }
                    if (data.orders && Array.isArray(data.orders)) {
                        const mappedOrders = data.orders.map((o: any) => ({
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
                            source: 'MT5',
                        }));
                        deps.setOrders(mappedOrders);
                    }
                    wsRuntime.positionUpdateTimer = null;
                }, POSITION_BUFFER_MS);
            }
        }

        if (msgType === 'optimization_result') {
            const result = msg.data;
            const setOptimizationResult = useMarketStore.getState().setOptimizationResult;
            if (setOptimizationResult) {
                setOptimizationResult(result);
            }
        }

        if (msgType === 'binance_positions_update') {
            if (msg.account) {
                deps.setAccount('BINANCE_DEMO', msg.account);
            }
            if (msg.positions && Array.isArray(msg.positions)) {
                const mapped = msg.positions.map((p: any) => ({ ...p, source: 'BINANCE_DEMO' }));
                deps.setPositions(mapped);
            }
            if (msg.history && Array.isArray(msg.history)) {
                const mapped = msg.history.map((h: any) => ({ ...h, source: 'BINANCE_DEMO' }));
                deps.appendHistory(mapped, true);
            }
        }

        if (msgType === 'binance_order_result') {
            if (msg.status === 'success') {
                useMarketStore.getState().addNotification(
                    `Binance Order Success: ${msg.message || 'Trade executed'}`,
                    'success',
                );
            } else {
                useMarketStore.getState().addNotification(`Binance Order Failed: ${msg.message}`, 'error');
            }
        }

        if (msgType === 'mt5_history_deals') {
            const dealData = Array.isArray(msg.data) ? msg.data : [];
            const isChunk = msg.is_chunk !== undefined ? msg.is_chunk : false;
            const isReset = isChunk === false;
            deps.appendHistory(dealData, isReset);
        }

        if (msgType === 'mt5_symbol_info') {
            deps.setSymbolInfo(msg.data);
        }

        if (msgType === 'mt5_available_symbols') {
            deps.setAvailableSymbols(msg.symbols || []);
        }

        if (msgType === 'alert_triggered') {
            const { alert, message, direction } = msg as any;
            useMarketStore.getState().updateAlert(alert.id, { active: false, direction });
            useMarketStore.getState().addNotification(
                message,
                direction === 'bullish' ? 'success' : 'warning',
                alert.id,
            );
            soundService.playAlert();
        }

        if (msgType === 'strategy_alert') {
            if (!STRATEGY_ENGINE_ENABLED) {
                // Strategy engine is intentionally disabled in public endpoint release.
            } else {
                const { signal } = msg;
                const direction = signal.signal === 'BUY' ? 'bullish' : 'bearish';
                useMarketStore.getState().addNotification(
                    `STRATEGY: ${signal.signal} ${signal.symbol} - ${signal.params.reason}`,
                    direction === 'bullish' ? 'success' : 'warning',
                );
                soundService.playAlert();
            }
        }
    } catch {
        // Ignore malformed WS frames.
    }
}
