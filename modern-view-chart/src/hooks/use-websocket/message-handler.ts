import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { soundService } from '@/features/strategy/logic/SoundService';
import { voiceNotifier } from '@/features/notifications/voice';
import { STRATEGY_ENGINE_ENABLED, CANDLE_BUFFER_MS, POSITION_BUFFER_MS, TICKER_BUFFER_MS } from './constants';
import { wsRuntime } from './runtime';
import { buildActiveSymbolSet } from './symbol-utils';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { getAvailableMt5Symbol } from './symbol-message-utils';

export interface MessageHandlerDeps {
    updateTickers: (tickers: Record<string, unknown>) => void;
    setCandles: (source: string, symbol: string, interval: string, data: Array<Record<string, unknown>>) => void;
    updateLastCandle: (source: string, symbol: string, interval: string, candle: Record<string, unknown>) => void;
    setBridgeOnline: (online: boolean) => void;
    setAccount: (source: string, account: Record<string, unknown>) => void;
    setPositions: (positions: Array<Record<string, unknown>>) => void;
    setOrders: (orders: Array<Record<string, unknown>>) => void;
    appendHistory: (items: Array<Record<string, unknown>>, isReset: boolean) => void;
    setSymbolInfo: (info: Record<string, unknown>) => void;
    setAvailableSymbols: (symbols: string[]) => void;
}

type CandleBufferItem = {
    source: string;
    symbol: string;
    interval: string;
    candle: Record<string, unknown>;
};

export function handleSocketMessage(event: MessageEvent, socket: WebSocket, deps: MessageHandlerDeps) {
    try {
        wsRuntime.lastMessageAt = Date.now();
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        const msgType = msg.topic || msg.event || msg.type;
        if (msgType === 'app_pong') {
            wsRuntime.lastAppPongAt = Date.now();
            return;
        }
        if (msgType === 'error' && String(msg?.code || '').toLowerCase() === 'unauthorized') {
            wsRuntime.unauthorizedFrameReceived = true;
            socket.close(1008, 'Unauthorized');
            return;
        }

        if ((msgType === 'priceUpdate' && Array.isArray(msg.data)) || msgType === 'tick' || msgType === 'mt5_update') {
            const state = useMarketStore.getState();
            const activeSymbols = buildActiveSymbolSet(state);

            const incomingData = msgType === 'priceUpdate' ? (msg.data as Array<Record<string, unknown>>) : [msg];
            let usefulUpdate = false;
            incomingData.forEach((item) => {
                const symbol = String(item?.symbol || '');
                if (activeSymbols.has(symbol)) {
                    wsRuntime.tickerUpdateBuffer[symbol] = {
                        symbol,
                        price: Number(item?.price || 0),
                        change: Number(item?.change || 0),
                        changeValue: Number(item?.changeValue || 0),
                        volume: 0,
                        source: String(item?.source || 'MT5'),
                        bid: item?.bid !== undefined ? Number(item.bid || 0) : undefined,
                        ask: item?.ask !== undefined ? Number(item.ask || 0) : undefined,
                        displayName: item?.displayName ? String(item.displayName) : undefined,
                        serverTime: Number(item?.serverTime || item?.time || 0) || undefined,
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

        if ((msgType === 'mt5_candles' || msgType === 'mt5_candles_at') && Array.isArray(msg.candles)) {
            const targetSymbol = String(msg.symbol || '');
            let targetInterval = String(msg.interval || '').trim();
            const normalizedCandles = (msg.candles as Array<Record<string, unknown>>).map((c) => ({
                ...c,
                time: c.time ?? c.t ?? c.timestamp ?? c.datetime,
                open: c.open ?? c.o ?? c.open_price ?? c.price_open,
                high: c.high ?? c.h ?? c.high_price ?? c.price_high,
                low: c.low ?? c.l ?? c.low_price ?? c.price_low,
                close: c.close ?? c.c ?? c.close_price ?? c.price_close,
                volume: c.volume ?? c.v ?? c.tick_volume ?? c.real_volume ?? 0,
            }));
            const source = String(msg.source || 'MT5');
            if (!targetInterval && targetSymbol) {
                const state = useMarketStore.getState();
                const wantedSymbol = normalizeSymbol(targetSymbol);
                const wantedSource = source.toUpperCase();
                const activeTab = state.tabs[state.activeTabId];
                if (activeTab?.activeChartId) {
                    const activeChart = activeTab.charts?.[activeTab.activeChartId];
                    if (activeChart) {
                        const activeSymbol = normalizeSymbol(String(activeChart.symbol || ''));
                        const activeSource = String(activeChart.source || '').toUpperCase();
                        if (activeSymbol === wantedSymbol && activeSource === wantedSource) {
                            targetInterval = String(activeChart.interval || '').trim();
                        }
                    }
                }
            }

            if (targetSymbol && targetInterval) {
                deps.setCandles(source, targetSymbol, targetInterval, normalizedCandles);
            }
        }

        if (msgType === 'candleUpdate' && msg.data) {
            const c = msg.data as Record<string, unknown>;
            const symbol = String(c.symbol || '');
            const interval = String(c.interval || '');
            const source = String(c.source || '').toUpperCase() || (
                symbol.toUpperCase().includes('USDT') ? 'BINANCE' : 'MT5'
            );
            const key = `${source}:${symbol}:${interval}`;
            wsRuntime.candleUpdateBuffer[key] = { source, symbol, interval, candle: c };

            if (!wsRuntime.candleUpdateTimer) {
                wsRuntime.candleUpdateTimer = setTimeout(() => {
                    const bufferedItems = Object.values(wsRuntime.candleUpdateBuffer) as CandleBufferItem[];
                    bufferedItems.forEach((item) => {
                        deps.updateLastCandle(item.source, item.symbol, item.interval, item.candle);
                    });
                    wsRuntime.candleUpdateBuffer = {};
                    wsRuntime.candleUpdateTimer = null;
                }, CANDLE_BUFFER_MS);
            }
        }

        if (msgType === 'bridgeStatus') {
            const online = Boolean(msg.online);
            deps.setBridgeOnline(online);
            if (online) wsRuntime.historyFetched = false;
        }

        if (msgType === 'mt5_positions_update') {
            wsRuntime.positionUpdateBuffer = msg;
            if (!wsRuntime.positionUpdateTimer) {
                wsRuntime.positionUpdateTimer = setTimeout(() => {
                    const data = wsRuntime.positionUpdateBuffer;
                    if (!data) {
                        wsRuntime.positionUpdateTimer = null;
                        return;
                    }
                    if (data?.account) {
                        deps.setAccount('MT5', data.account as Record<string, unknown>);
                    }
                    if (data.positions && Array.isArray(data.positions)) {
                        const mappedPositions = data.positions.map((p: Record<string, unknown>) => ({
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
                        const mappedOrders = data.orders.map((o: Record<string, unknown>) => ({
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
                setOptimizationResult(result as any);
            }
        }

        if (msgType === 'binance_positions_update') {
            if (msg.account) deps.setAccount('BINANCE_DEMO', msg.account as any);
            if (msg.positions && Array.isArray(msg.positions)) {
                const mapped = msg.positions.map((p: any) => ({ ...p, source: 'BINANCE_DEMO' }));
                deps.setPositions(mapped);
            }
        }

        if (msgType === 'binance_order_result') {
            const status = msg.status === 'success' ? 'success' : 'error';
            useMarketStore.getState().addNotification(`Binance Order ${msg.status}: ${msg.message || ''}`, status);
        }

        if (msgType === 'mt5_history_deals') {
            const dealData = Array.isArray(msg.data) ? msg.data : [];
            const isReset = (msg.is_chunk === false);
            deps.appendHistory(dealData, isReset);
        }

        if (msgType === 'mt5_symbol_info') {
            deps.setSymbolInfo(msg.data as any);
        }

        if (msgType === 'mt5_available_symbols') {
            const symbols = Array.isArray(msg.symbols)
                ? msg.symbols.map(getAvailableMt5Symbol).filter(Boolean)
                : [];
            deps.setAvailableSymbols(symbols);
        }

        if (msgType === 'alert_triggered') {
            const alert = msg.alert as Record<string, unknown>;
            const message = String(msg.message || '');
            const direction = String(msg.direction || '');
            console.log('[WS] alert_triggered received:', { alert, message, direction });
            
            const normalizedDirection = (direction === 'bullish' || direction === 'bearish') ? direction : undefined;
            
            useMarketStore.getState().updateAlert(String(alert.id || ''), { active: false, direction: normalizedDirection });
            useMarketStore.getState().addNotification(message, direction === 'bullish' ? 'success' : 'warning', String(alert.id || ''));
            
            soundService.playAlert();
            
            const uiState = useMarketStore.getState();
            if (uiState.voiceAlertsEnabled) {
                voiceNotifier.setEnabled(true);
                voiceNotifier.setPreferPreGeneratedAudio(Boolean(uiState.voiceAlertsUsePreGeneratedAudio));
                voiceNotifier.notify({
                    symbol: String(alert.symbol || ''),
                    price: Number(alert.price || 0),
                    direction: normalizedDirection,
                    message,
                });
            }
        }

        if (msgType === 'strategy_alert') {
            console.log('[WS] strategy_alert received:', msg);
            if (!STRATEGY_ENGINE_ENABLED) {
                console.warn('[WS] strategy_alert ignored: STRATEGY_ENGINE_ENABLED is false');
            } else {
                const signal = msg.signal as Record<string, unknown>;
                const direction = String(signal.signal || '') === 'BUY' ? 'bullish' : 'bearish';
                
                console.log('[WS] Processing strategy signal:', { symbol: signal.symbol, action: signal.signal });
                
                useMarketStore.getState().addNotification(
                    `STRATEGY: ${String(signal.signal || '')} ${String(signal.symbol || '')} - ${String((signal.params as any)?.reason || '')}`,
                    direction === 'bullish' ? 'success' : 'warning',
                );
                
                soundService.playAlert();

                const uiState = useMarketStore.getState();
                if (uiState.voiceAlertsEnabled) {
                    voiceNotifier.setEnabled(true);
                    voiceNotifier.setPreferPreGeneratedAudio(Boolean(uiState.voiceAlertsUsePreGeneratedAudio));
                    voiceNotifier.notify({
                        symbol: String(signal.symbol || ''),
                        price: Number(signal.price || 0),
                        direction: direction,
                        message: `Tín hiệu ${String(signal.signal || '') === 'BUY' ? 'Mua' : 'Bán'} ${String(signal.symbol || '')} từ chiến lược.`,
                    });
                }
            }
        }
    } catch (err) {
        console.error('[WS] Error handling message:', err);
    }
}
