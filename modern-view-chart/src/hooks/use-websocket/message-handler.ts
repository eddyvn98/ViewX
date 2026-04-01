import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { soundService } from '@/features/strategy/logic/SoundService';
import { STRATEGY_ENGINE_ENABLED, CANDLE_BUFFER_MS, POSITION_BUFFER_MS, TICKER_BUFFER_MS } from './constants';
import { wsRuntime } from './runtime';
import { buildActiveSymbolSet } from './symbol-utils';
import { normalizeSymbol } from '@/lib/utils/symbol';

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
    setAvailableSymbols: (symbols: Array<Record<string, unknown> | string>) => void;
}

type CandleBufferItem = {
    source: string;
    symbol: string;
    interval: string;
    candle: Record<string, unknown>;
};

function normalizeSource(raw: unknown): string {
    const text = String(raw || '').trim();
    if (!text) return 'MT5';
    const upper = text.toUpperCase();
    if (upper.startsWith('MT5')) return 'MT5';
    if (upper.startsWith('BINANCE')) return 'BINANCE';
    return text;
}

function normalizeIntervalId(raw: unknown): string {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (/^\d+$/.test(text)) return text;

    const normalized = text.toLowerCase();
    let match = normalized.match(/^m(\d+)$/);
    if (match) return String(Number(match[1]));
    match = normalized.match(/^(\d+)m$/);
    if (match) return String(Number(match[1]));

    match = normalized.match(/^h(\d+)$/);
    if (match) return String(Number(match[1]) * 60);
    match = normalized.match(/^(\d+)h$/);
    if (match) return String(Number(match[1]) * 60);

    match = normalized.match(/^d(\d+)$/);
    if (match) return String(Number(match[1]) * 1440);
    match = normalized.match(/^(\d+)d$/);
    if (match) return String(Number(match[1]) * 1440);

    match = normalized.match(/^w(\d+)$/);
    if (match) return String(Number(match[1]) * 10080);
    match = normalized.match(/^(\d+)w$/);
    if (match) return String(Number(match[1]) * 10080);

    match = normalized.match(/^mn(\d+)$/);
    if (match) return String(Number(match[1]) * 43200);

    return text;
}

export function handleSocketMessage(event: MessageEvent, socket: WebSocket, deps: MessageHandlerDeps) {
    try {
        wsRuntime.lastMessageAt = Date.now();
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        const msgType = msg.topic || msg.event || msg.type;
        if (msgType === 'app_pong') {
            wsRuntime.lastAppPongAt = Date.now();
            return;
        }
        if (msgType === 'error') {
            const code = String(msg?.code || '').toLowerCase();
            const detail = String(msg?.detail || '').toLowerCase();
            if (code === 'unauthorized') {
                wsRuntime.unauthorizedFrameReceived = true;
                socket.close(1008, 'Unauthorized');
                return;
            }

            // Recover from stale/mismatched bridge routing without requiring F5.
            if (code === 'bridge_not_found' || detail.includes('no_bridge_registered')) {
                deps.setBridgeOnline(false);
                return;
            }
        }
        if (msgType === 'module_access_updated') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('auth-changed'));
            }
            useMarketStore.getState().addNotification('Module da duoc kich hoat. He thong dang cap nhat quyen...', 'success');
            return;
        }

        const mt5Source = normalizeSource(msg.mt5_source || msg.source || 'MT5');

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
                        source: String(item?.source || item?.mt5_source || mt5Source || 'MT5'),
                        serverTime: item?.time,
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
            let targetInterval = normalizeIntervalId(msg.interval);
            const normalizedCandles = (msg.candles as Array<Record<string, unknown>>).map((c) => ({
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
                source: mt5Source,
                sampleTime: sample?.time,
                sampleOpen: sample?.open,
            });
            const source = mt5Source;
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
                            targetInterval = normalizeIntervalId(activeChart.interval);
                        }
                    }
                }
                if (!targetInterval) {
                    for (const tab of Object.values(state.tabs)) {
                        for (const chart of Object.values(tab.charts || {})) {
                            const chartSymbol = normalizeSymbol(String(chart.symbol || ''));
                            const chartSource = String(chart.source || '').toUpperCase();
                            if (chartSymbol === wantedSymbol && chartSource === wantedSource) {
                                targetInterval = normalizeIntervalId(chart.interval);
                                break;
                            }
                        }
                        if (targetInterval) break;
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
            const interval = normalizeIntervalId(c.interval);
            const source = normalizeSource(symbol.toUpperCase().includes('USDT') ? 'BINANCE' : c.source || c.mt5_source || 'MT5');
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
                        deps.setAccount(mt5Source, {
                            balance: Number((data.account as Record<string, unknown>).balance) || 0,
                            equity: Number((data.account as Record<string, unknown>).equity) || 0,
                            margin: Number((data.account as Record<string, unknown>).margin) || 0,
                            free_margin: Number((data.account as Record<string, unknown>).free_margin) || 0,
                            margin_level: Number((data.account as Record<string, unknown>).margin_level) || 0,
                            profit: Number((data.account as Record<string, unknown>).profit) || 0,
                        });
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
                            source: mt5Source,
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
                            source: mt5Source,
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
                setOptimizationResult(result as Parameters<typeof setOptimizationResult>[0]);
            }
        }

        if (msgType === 'binance_positions_update') {
            if (msg.account) {
                deps.setAccount('BINANCE_DEMO', msg.account as Record<string, unknown>);
            }
            if (msg.positions && Array.isArray(msg.positions)) {
                const mapped = msg.positions.map((p: Record<string, unknown>) => ({ ...p, source: 'BINANCE_DEMO' }));
                deps.setPositions(mapped);
            }
            if (msg.history && Array.isArray(msg.history)) {
                const mapped = msg.history.map((h: Record<string, unknown>) => ({ ...h, source: 'BINANCE_DEMO' }));
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
            deps.setSymbolInfo(msg.data as Record<string, unknown>);
        }

        if (msgType === 'mt5_available_symbols') {
            const symbols = Array.isArray(msg.symbols)
                ? msg.symbols
                    .map((entry) => {
                        if (typeof entry === 'string') return entry.trim();
                        if (!entry || typeof entry !== 'object') return '';
                        const raw = (entry as Record<string, unknown>).symbol
                            ?? (entry as Record<string, unknown>).rawSymbol
                            ?? (entry as Record<string, unknown>).raw_symbol
                            ?? (entry as Record<string, unknown>).canonicalSymbol;
                        const symbol = String(raw || '').trim();
                        if (!symbol) return '';
                        return { ...(entry as Record<string, unknown>), symbol };
                    })
                    .filter(Boolean)
                : [];
            deps.setAvailableSymbols(symbols);
        }

        if (msgType === 'alert_triggered') {
            const alert = msg.alert as Record<string, unknown>;
            const message = String(msg.message || '');
            const direction = String(msg.direction || '');
            const normalizedDirection =
                direction === 'bullish' || direction === 'bearish'
                    ? direction
                    : undefined;
            useMarketStore.getState().updateAlert(String(alert.id || ''), { active: false, direction: normalizedDirection });
            useMarketStore.getState().addNotification(
                message,
                direction === 'bullish' ? 'success' : 'warning',
                String(alert.id || ''),
            );
            soundService.playAlert();
        }

        if (msgType === 'strategy_alert') {
            if (!STRATEGY_ENGINE_ENABLED) {
                // Strategy engine is intentionally disabled in public endpoint release.
            } else {
                const signal = msg.signal as Record<string, unknown>;
                const direction = String(signal.signal || '') === 'BUY' ? 'bullish' : 'bearish';
                useMarketStore.getState().addNotification(
                    `STRATEGY: ${String(signal.signal || '')} ${String(signal.symbol || '')} - ${String((signal.params as Record<string, unknown>)?.reason || '')}`,
                    direction === 'bullish' ? 'success' : 'warning',
                );
                soundService.playAlert();
            }
        }
    } catch {
        // Ignore malformed WS frames.
    }
}
