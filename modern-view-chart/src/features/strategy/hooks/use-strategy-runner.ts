
import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '../store/strategy-store';
import { RuleEngine, EngineContext } from '../logic/RuleEngine';
import { AiManager, MarketMetrics } from '../logic/AiManager';
import { TradeLogger } from '../logic/TradeLogger';
import { StatsService } from '../logic/StatsService';
import { AiAnalyzer } from '../logic/AiAnalyzer';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';
import { Strategy, VirtualPosition } from '../types';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { IndicatorCalculator } from '../logic/IndicatorCalculator';
import { RiskCalculator } from '../logic/RiskCalculator';
import { ContextCollector } from '../logic/ContextCollector';

export function useStrategyRunner() {
    const {
        strategies,
        addSignal,
        updateStrategy,
        updateLastSignalTime,
        addVirtualPosition,
        closeVirtualPosition,
        cancelVirtualPosition,
        updateVirtualPosition,
        virtualPositions
    } = useStrategyStore();
    const { sendMessage } = useWebSocket();
    const candleData = useMarketStore(state => state.candleData);
    const activeTabId = useMarketStore(state => state.activeTabId);
    const tabs = useMarketStore(state => state.tabs);
    const positions = useMarketStore(state => (state as any).positions) || [];

    const lastProcessedTimeRef = useRef<Record<string, number>>({});
    const lastBarTimeRef = useRef<Record<string, number>>({});
    const isRunningRef = useRef(false);

    const runBacktest = useStrategyStore(state => state.runBacktest);
    const backtestRunRef = useRef<Record<string, number>>({});

    useEffect(() => {
        // MIGRATION: Auto-patch existing strategies with missing cancelConditions
        strategies.forEach(s => {
            if (!s.cancelConditions && (s.id.includes('hull-ha-gold') || s.name.toLowerCase().includes('hull ha'))) {
                const cancelConditions = s.side === 'BUY'
                    ? { operator: 'OR' as const, conditions: [{ id: 'buy-cancel-rsi', left: { type: 'RSI' as const, params: [14] }, comparator: '<' as const, right: 55 }] }
                    : { operator: 'OR' as const, conditions: [{ id: 'sell-cancel-rsi', left: { type: 'RSI' as const, params: [14] }, comparator: '>' as const, right: 45 }] };

                console.log(`[Migration] Patching cancel conditions for ${s.name}`);
                updateStrategy(s.id, { cancelConditions });
            }

            // FORCE DYNAMIC FOR TEST STRATEGY (Fix Persistence Issue)
            if (s.id === 'test-trigger-rsi' && s.symbol !== '') {
                console.log(`[Migration] Forcing Dynamic Symbol for ${s.name}`);
                updateStrategy(s.id, { symbol: '' });
            }

            // AUTO-BACKTEST TRIGGER
            // Run backtest if strategy is active and we have candle data, and haven't run it recently
            if (s.active) {
                // Find matching candles
                // We need to find the correct key from candleData which matches s.symbol and s.timeframe
                // This is a bit tricky as candleData keys are "source:symbol:interval"
                // We'll iterate candleData keys to find match
                const interval = s.timeframe || '1m';
                let dataKey: string | undefined;

                if (s.symbol) {
                    const normSymbol = normalizeSymbol(s.symbol);
                    dataKey = Object.keys(candleData).find(k => k.includes(`:${normSymbol}:${interval}`));
                } else {
                    // DYNAMIC MODE: Use the first available data key that matches timeframe (likely the active chart)
                    // Priority: Try to match active tab symbol if possible, else any
                    // Since we don't have easy access to active symbol here without iterating tabs, 
                    // we'll just pick the first valid data source with enough length
                    dataKey = Object.keys(candleData).find(k => k.endsWith(`:${interval}`) && candleData[k].length > 100);
                }

                if (dataKey && candleData[dataKey] && candleData[dataKey].length > 100) {
                    const lastRun = backtestRunRef.current[s.id] || 0;
                    // Run only once per session or if strategy config changes
                    if (Date.now() - lastRun > 60000) {
                        console.log(`[Backtest] Auto-triggering for ${s.name} (${s.id}) using data: ${dataKey}`);

                        // Extract symbol from dataKey if strategy symbol is missing
                        // dataKey format: source:symbol:interval
                        const parts = dataKey.split(':');
                        const actualSymbol = s.symbol || (parts.length >= 2 ? parts[1] : 'BACKTEST');

                        runBacktest(s.id, candleData[dataKey], actualSymbol);
                        backtestRunRef.current[s.id] = Date.now();
                    }
                }
            }
        });

        console.log(`[Store] Total Strategies: ${strategies.length}`);
        strategies.forEach(s => console.log(`  > ${s.name} (${s.id}) | Active: ${s.active} | Sym: ${s.symbol}`));
    }, [strategies.length, strategies, candleData, runBacktest]);


    useEffect(() => {
        // console.log(`[Runner] Effect Triggered: Data=${Object.keys(candleData).length} Tabs=${Object.keys(tabs).length} Strats=${strategies.length}`);

        if (isRunningRef.current) return;

        const runCycle = async () => {
            isRunningRef.current = true;
            try {
                // 1. Collect unique configurations from active tabs
                const uniqueChartConfigs: { symbol: string; interval: string; source: string }[] = [];
                const uniqueKeys = new Set<string>();

                Object.values(tabs).forEach(tab => {
                    Object.values(tab.charts).forEach(chart => {
                        const s = chart.symbol;
                        const i = chart.interval || '1m';
                        const src = chart.source || 'default';
                        const k = `${src}:${normalizeSymbol(s)}:${i}`;
                        if (!uniqueKeys.has(k)) {
                            uniqueKeys.add(k);
                            uniqueChartConfigs.push({ symbol: s, interval: i, source: src });
                        }
                    });
                });

                if (uniqueChartConfigs.length === 0) return;

                // 2. Loop through each chart configuration
                for (const config of uniqueChartConfigs) {
                    const { symbol, interval, source } = config;
                    const normSymbol = normalizeSymbol(symbol);
                    const pairKey = `${source}:${normSymbol}:${interval}`;
                    const candles = candleData[pairKey];

                    if (!candles || candles.length < 5) continue;

                    const activeStrategies = strategies.filter(s => {
                        if (!s.active) return false;
                        const symbolMatch = !s.symbol || normalizeSymbol(s.symbol) === normSymbol;
                        const timeframeMatch = !s.timeframe || s.timeframe === interval;
                        return symbolMatch && timeframeMatch;
                    });

                    if (activeStrategies.length === 0) continue;

                    const lastCandle = candles[candles.length - 1];
                    const lastTime = typeof lastCandle.time === 'object' ? (lastCandle.time as any).timestamp : Number(lastCandle.time);

                    for (const strategy of activeStrategies) {
                        const processKey = `${strategy.id}:${symbol}`;

                        // Throttling: Max once per 1s per strategy/symbol
                        if (Date.now() - (lastProcessedTimeRef.current[processKey] || 0) < 1000) continue;
                        lastProcessedTimeRef.current[processKey] = Date.now();

                        try {
                            const isNewBar = lastTime > (lastBarTimeRef.current[processKey] || 0);
                            if (isNewBar) lastBarTimeRef.current[processKey] = lastTime;

                            const store = useStrategyStore.getState();
                            const currentVirtualPositions = store.virtualPositions;
                            const stratPos = currentVirtualPositions.filter(p => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed');

                            // --- DIAGNOSTIC LOG (Heartbeat) ---
                            if (Math.random() < 0.02) { // 2% chance to avoid log spam
                                console.log(`[💓] Runner: ${strategy.name} | ${symbol} | Active:${stratPos.length} | Bar:${isNewBar}`);
                            }

                            // 1. PROTECTION & TRADE MANAGEMENT (Runs on every tick)
                            stratPos.forEach(pos => {
                                if (pos.status === 'open' || pos.status === 'pending') {
                                    const currentPrice = lastCandle.close;

                                    // Trailing Stop Logic
                                    if (strategy.risk.trailing) {
                                        const tSource = strategy.risk.trailingSource || (pos.type === 'BUY' ? 'HA_Low' : 'HA_High');
                                        const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, candles.slice(0, -1));
                                        const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, candles.slice(0, -1));

                                        const priceOffset = symbol.includes('XAU') ? 0.3 : (symbol.includes('JPY') ? 0.01 : 0.0001);
                                        const moveThreshold = priceOffset * 0.2;

                                        let targetSl = pos.sl;
                                        let updated = false;

                                        if (pos.type === 'BUY' && tSource === 'HA_Low' && haLow > pos.sl + moveThreshold) {
                                            targetSl = haLow;
                                            updated = true;
                                        } else if (pos.type === 'SELL' && tSource === 'HA_High') {
                                            const sellProposedSl = haHigh + priceOffset;
                                            if (pos.sl === 0 || sellProposedSl < pos.sl - moveThreshold) {
                                                targetSl = sellProposedSl;
                                                updated = true;
                                            }
                                        }

                                        if (updated) {
                                            const isSafe = pos.type === 'BUY' ? targetSl < currentPrice : targetSl > currentPrice;
                                            if (isSafe || pos.status === 'pending') {
                                                store.updateVirtualPosition(pos.id, { sl: targetSl });
                                                if (strategy.executionMode === 'real') {
                                                    sendMessage({ topic: 'mt5_command', command: 'modify_order', ticket: (pos as any).ticket, sl: targetSl, tp: pos.tp });
                                                }
                                            }
                                        }
                                    }

                                    // MAE/MFE & Core Exits
                                    if (pos.status === 'open') {
                                        const pnlFloat = pos.type === 'BUY' ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
                                        const meta = pos.metadata || { indicators_snapshot: {}, session: 'Asian' };
                                        const nextMae = Math.min(meta.mae ?? 0, pnlFloat);
                                        const nextMfe = Math.max(meta.mfe ?? 0, pnlFloat);

                                        if (nextMae !== meta.mae || nextMfe !== meta.mfe) {
                                            store.updateVirtualPosition(pos.id, { metadata: { ...meta, mae: nextMae, mfe: nextMfe } });
                                        }

                                        // SL/TP Hard Check
                                        if (Date.now() - pos.timestamp >= 5000) {
                                            let exitP = null; let exitR = '';
                                            if (pos.type === 'BUY') {
                                                if (pos.sl && currentPrice <= pos.sl) { exitP = pos.sl; exitR = 'SL'; }
                                                else if (pos.tp && currentPrice >= pos.tp) { exitP = pos.tp; exitR = 'TP'; }
                                            } else {
                                                if (pos.sl && currentPrice >= pos.sl) { exitP = pos.sl; exitR = 'SL'; }
                                                else if (pos.tp && currentPrice <= pos.tp) { exitP = pos.tp; exitR = 'TP'; }
                                            }
                                            if (exitP) {
                                                store.closeVirtualPosition(strategy.id, symbol, exitP, { exit_reason: exitR as any });
                                                toast.warning(`[${exitR}] ${pos.symbol} Closed @ ${exitP}`);
                                            }
                                        }
                                    } else {
                                        // Pending Order Filling
                                        if ((pos.type === 'BUY' && currentPrice >= pos.entryPrice) || (pos.type === 'SELL' && currentPrice <= pos.entryPrice)) {
                                            store.updateVirtualPosition(pos.id, { status: 'open', entryPrice: pos.entryPrice, timestamp: Date.now() });
                                            toast.success(`[FILLED] ${pos.type} ${pos.symbol} @ ${pos.entryPrice}`);
                                        }
                                    }
                                }
                            });

                            // 2. SIGNAL GENERATION & RULE EVALUATION (Runs on BAR CLOSE or if flat)
                            if (!isNewBar) {
                                // Background Capture for Post-Exit Analysis
                                const expiredClosed = currentVirtualPositions.filter(p => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'closed' && p.exitTimestamp && (Date.now() - p.exitTimestamp > 60000) && (Date.now() - p.exitTimestamp < 300000) && !p.metadata?.post_exit);
                                expiredClosed.forEach(p => {
                                    const postExit = ContextCollector.capturePostExitContext(strategy, candles);
                                    store.updateVirtualPosition(p.id, { metadata: { ...p.metadata, post_exit: postExit } as any });
                                });
                                continue;
                            }

                            // Fresh context for Rule Engine
                            const engineCtx: EngineContext = {
                                activePositions: [...positions, ...currentVirtualPositions],
                                currentPrice: lastCandle.close,
                                symbol,
                                lastSignalTime: strategy.lastSignalTime
                            };

                            const signal = RuleEngine.run(strategy, candles, engineCtx);

                            if (signal) {
                                const mMetrics = { spread: 2, volatility: 30, trendStrength: 25, rsi: 50, session: "London" };
                                let final = AiManager.processSignal(signal, mMetrics);
                                if (!final) continue;

                                if (final.type === 'CANCEL') {
                                    const pnd = currentVirtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
                                    if (pnd) {
                                        store.cancelVirtualPosition(strategy.id, symbol);
                                        if (strategy.executionMode === 'real') sendMessage({ topic: 'mt5_command', command: 'close_by_magic', symbol, magic: strategy.magic || 0 });
                                        toast.warning(`[CANCEL] ${strategy.name} order killed.`);
                                    }
                                    continue;
                                }

                                if (final.type !== 'EXIT') {
                                    if (store.virtualPositions.some(p => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed')) continue;

                                    // ⚡ NON-BLOCKING BACKGROUND TASKS (Supabase, AI)
                                    (async () => {
                                        try {
                                            const stats = await StatsService.compute(strategy.id);
                                            const ai = await AiAnalyzer.analyzeSignal(strategy.id, final!, mMetrics, stats);
                                            final = { ...final!, aiAnalysis: ai };
                                            await TradeLogger.logEntry(final, mMetrics);
                                        } catch (e) { console.error("[Runner] Sync Task Failed:", e); }
                                    })();

                                    const side = final.type as 'BUY' | 'SELL';
                                    const pip = symbol.includes('XAU') ? 0.1 : (symbol.includes('JPY') ? 0.01 : 0.0001);
                                    const sl = RiskCalculator.calculateLevel(strategy.risk.sl, 'sl', side, candles, lastCandle.close, pip);
                                    const tp = RiskCalculator.calculateLevel(strategy.risk.tp, 'tp', side, candles, lastCandle.close, pip, lastCandle.close);
                                    const bal = strategy.executionMode === 'real' ? (Object.values(useMarketStore.getState().accounts)[0]?.balance || 10000) : store.virtualBalance;
                                    const lot = RiskCalculator.calculateLot(strategy.risk.lotSize, sl, lastCandle.close, bal, symbol);

                                    const pId = `v-${Date.now()}`;
                                    const isMkt = strategy.entryType === 'market';
                                    const entryP = isMkt ? lastCandle.close : (side === 'BUY' ? lastCandle.high + (pip * 3) : lastCandle.low);

                                    store.addVirtualPosition({ id: pId, strategyId: strategy.id, symbol, type: side, entryPrice: entryP, sl, tp, lotSize: lot, timestamp: Date.now(), status: isMkt ? 'open' : 'pending', metadata: final.context });
                                    if (strategy.executionMode === 'real') sendMessage({ topic: 'mt5_command', command: 'order', symbol, is_market: isMkt, type: isMkt ? side.toLowerCase() : (side === 'BUY' ? 'buy_stop' : 'sell_stop'), price: entryP, volume: lot, sl, tp, magic: strategy.magic || 0, comment: strategy.comment || 'Web' });
                                    store.updateLastSignalTime(strategy.id, lastTime);
                                } else {
                                    // Background Update
                                    TradeLogger.updateExit(strategy.id, symbol, final.price).catch(e => console.error(e));

                                    const pnd = currentVirtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
                                    if (pnd) store.cancelVirtualPosition(strategy.id, symbol);
                                    else store.closeVirtualPosition(strategy.id, symbol, final.price, { exit_reason: 'SIGNAL' });

                                    if (strategy.executionMode === 'real') sendMessage({ topic: 'mt5_command', command: 'close_by_magic', symbol, magic: strategy.magic || 0 });
                                }
                                store.addSignal(final);
                                toast.info(`[${final.type}] ${strategy.name} on ${symbol}`);
                            }
                        } catch (sErr) {
                            console.error(`[Runner] Strategy ${strategy.name} error:`, sErr);
                        }
                    }
                }
            } catch (fatalErr) {
                console.error("[Runner] FATAL Error in loop:", fatalErr);
            } finally {
                isRunningRef.current = false;
            }
        };

        runCycle();
    }, [candleData, tabs, strategies]);
}
