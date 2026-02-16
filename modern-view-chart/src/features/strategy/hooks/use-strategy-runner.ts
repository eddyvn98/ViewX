
import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '../store/strategy-store';
import { RuleEngine, EngineContext } from '../logic/RuleEngine';
import { AiManager, MarketMetrics } from '../logic/AiManager';
import { TradeLogger } from '../logic/TradeLogger';
import { StatsService } from '../logic/StatsService';
import { AiAnalyzer, AnalysisType } from '../logic/AiAnalyzer';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';
import { Strategy, VirtualPosition } from '../types';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { IndicatorCalculator } from '../logic/IndicatorCalculator';
import { RiskCalculator } from '../logic/RiskCalculator';
import { ContextCollector } from '../logic/ContextCollector';
import { getPipMultiplier, getPriceOffset } from '../utils/market-utils';
import { getTradingSession, normalizeTF } from '../utils/time-utils';
import { soundService } from '../logic/SoundService';
import { backgroundService } from '../logic/BackgroundService';

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
        updateSignal,
        virtualPositions,
        lastResetTime
    } = useStrategyStore();
    const { sendMessage } = useWebSocket();
    const candleData = useMarketStore(state => state.candleData);
    const activeTabId = useMarketStore(state => state.activeTabId);
    const tabs = useMarketStore(state => state.tabs);
    // The log below seems intended for a component like StrategyMarkers, not useStrategyRunner directly.
    // As 'symbol' is not defined at this scope, and 'virtualPositions' is already destructured,
    // this line is commented out to maintain syntactical correctness within useStrategyRunner.
    // console.log(`[Markers-Render] Symbol: ${symbol} | Total Pos: ${virtualPositions.length}`);
    const positions = useMarketStore(state => (state as any).positions) || [];

    const lastProcessedTimeRef = useRef<Record<string, number>>({});
    const lastBarTimeRef = useRef<Record<string, number>>({});
    const isRunningRef = useRef(false);

    const runBacktest = useStrategyStore(state => state.runBacktest);
    const backtestRunRef = useRef<Record<string, number>>({}); // Track backtest runs to avoid loops

    // Reset backtest tracking when account is reset or strategy toggled
    useEffect(() => {
        console.log("🕯️ [Runner] Resetting backtest tracking due to account reset or strategy change");
        backtestRunRef.current = {};
    }, [lastResetTime]);

    // Handle single strategy activation - clear its specific cache
    useEffect(() => {
        strategies.forEach(s => {
            if (s.active && !backtestRunRef.current[s.id]) {
                // Keep it empty to trigger run
            }
        });
    }, [strategies]);

    // Track active tabs/charts to only run what's visible
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

            // AUTO-BACKTEST TRIGGER (WARMUP)
            // Run backtest if strategy is active and we have candle data, and haven't run it recently
            if (s.active) {
                const interval = s.timeframe || '1m';
                let dataKey: string | undefined;

                const availableKeys = Object.keys(candleData);

                const intervalNorm = normalizeTF(interval);

                if (s.symbol) {
                    const normSymbol = normalizeSymbol(s.symbol).toLowerCase();
                    // Robust search: ignore case and match symbol + normalized interval
                    dataKey = availableKeys.find(k => {
                        const parts = k.toLowerCase().split(':');
                        if (parts.length < 3) return false;
                        const kSymbol = parts[1];
                        const kInterval = normalizeTF(parts[2]);
                        return kSymbol === normSymbol && kInterval === intervalNorm;
                    });
                } else {
                    // DYNAMIC MODE: Priority to active chart or any valid data
                    const activeTab = activeTabId ? tabs[activeTabId] : null;
                    const activeChart = (activeTab?.activeChartId && activeTab?.charts) ? activeTab.charts[activeTab.activeChartId] : null;
                    const activeSymbol = normalizeSymbol(activeChart?.symbol).toLowerCase();

                    // Try to find active chart's data first
                    dataKey = availableKeys.find(k => {
                        const parts = k.toLowerCase().split(':');
                        return parts[1] === activeSymbol && normalizeTF(parts[2]) === intervalNorm && candleData[k].length >= 50;
                    });

                    // Fallback to any valid data if active chart doesn't match TF
                    if (!dataKey) {
                        dataKey = availableKeys.find(k => normalizeTF(k.split(':').pop()) === intervalNorm && candleData[k].length >= 50);
                    }
                }

                if (dataKey && candleData[dataKey] && candleData[dataKey].length >= 50) {
                    const lastRun = backtestRunRef.current[s.id] || 0;
                    const hasActivePos = virtualPositions.some(p => p.strategyId === s.id && p.status !== 'closed');
                    const hasHistoricalPos = virtualPositions.some(p => p.strategyId === s.id && p.isHistorical);

                    // TRIGGER: If no run recorded OR (is active but no positions at all AND enough time passed since last run)
                    const shouldTrigger = !lastRun || (!hasActivePos && !hasHistoricalPos && (Date.now() - lastRun > 10000));

                    if (shouldTrigger) {
                        const parts = dataKey.split(':');
                        console.log(`[Warmup] Triggering for ${s.name} (${s.id}) on ${dataKey}. Symbols identical: ${s.symbol === (parts[1] || '')}`);
                        const actualSymbol = s.symbol || (parts.length >= 2 ? parts[1] : 'BACKTEST');

                        // Set run time BEFORE async call to prevent rapid double-triggering
                        backtestRunRef.current[s.id] = Date.now();
                        runBacktest(s.id, [...candleData[dataKey]], actualSymbol);
                    }
                } else if (s.active && availableKeys.length > 0) {
                    // Only warn if we HAVE data but none matches this strategy
                    if (!dataKey) {
                        console.warn(`[Warmup] No dataKey found for ${s.name}. Symbol: ${s.symbol}, TF: ${interval}. Available:`, availableKeys);
                    } else if (candleData[dataKey].length < 50) {
                        if (Math.random() < 0.01) console.log(`[Warmup] Waiting for đủ nến cho ${s.name} (${candleData[dataKey].length}/50)`);
                    }
                }
            } else {
                // Reset run ref when strategy is deactivated to allow fresh warmup next time
                if (backtestRunRef.current[s.id]) {
                    console.log(`[Warmup] Resetting ref for ${s.name} (deactivated)`);
                    delete backtestRunRef.current[s.id];
                }
            }
        });

        console.log(`[Store] Total Strategies: ${strategies.length}`);
        strategies.forEach(s => console.log(`  > ${s.name} (${s.id}) | Active: ${s.active} | Sym: ${s.symbol}`));
    }, [strategies.length, strategies, candleData, runBacktest, lastResetTime]);


    // ⚡ BACKGROUND KEEP-ALIVE
    useEffect(() => {
        const activeCount = strategies.filter(s => s.active).length;
        if (activeCount > 0) {
            backgroundService.init();
            soundService.enableKeepAlive();
        } else {
            backgroundService.releaseWakeLock();
            soundService.disableKeepAlive();
        }

        return () => {
            backgroundService.releaseWakeLock();
            soundService.disableKeepAlive();
        };
    }, [strategies]);

    useEffect(() => {
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
                        const timeframeMatch = !s.timeframe || normalizeTF(s.timeframe) === normalizeTF(interval);
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
                                    // TRANSITION: If this is an 'open' position from backtest, 
                                    // tag it as LIVE (not historical anymore) so it doesn't get wiped by next backtest
                                    if (pos.isHistorical && pos.status === 'open') {
                                        console.log(`[Transition] Strategy ${strategy.name} taking over historical position ${pos.id}`);
                                        store.updateVirtualPosition(pos.id, { isHistorical: false, id: `v-taken-${Date.now()}` });
                                        return; // Process in next tick with new ID
                                    }

                                    const currentPrice = lastCandle.close;

                                    // Trailing Stop Logic
                                    if (strategy.risk.trailing) {
                                        const tSource = strategy.risk.trailingSource || (pos.type === 'BUY' ? 'HA_Low' : 'HA_High');
                                        const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, candles.slice(0, -1));
                                        const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, candles.slice(0, -1));

                                        const priceOffset = getPriceOffset(symbol);
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
                                        const pipsMultiplier = getPipMultiplier(symbol);

                                        const meta = pos.metadata || { indicators_snapshot: {}, session: getTradingSession(pos.timestamp) };

                                        // Track Duration
                                        const nextDuration = (meta.duration_candles || 0) + (isNewBar ? 1 : 0);

                                        // Track Max Excursion (Adverse and Favorable)
                                        let currentMae = meta.mae || 0;
                                        let currentMfe = meta.mfe || 0;

                                        if (pos.type === 'BUY') {
                                            const adverseDist = (pos.entryPrice - lastCandle.low) * pipsMultiplier;
                                            const favorableDist = (lastCandle.high - pos.entryPrice) * pipsMultiplier;
                                            currentMae = Math.max(currentMae, adverseDist);
                                            currentMfe = Math.max(currentMfe, favorableDist);
                                        } else {
                                            const adverseDist = (lastCandle.high - pos.entryPrice) * pipsMultiplier;
                                            const favorableDist = (pos.entryPrice - lastCandle.low) * pipsMultiplier;
                                            currentMae = Math.max(currentMae, adverseDist);
                                            currentMfe = Math.max(currentMfe, favorableDist);
                                        }

                                        if (currentMae !== meta.mae || currentMfe !== meta.mfe || nextDuration !== meta.duration_candles) {
                                            store.updateVirtualPosition(pos.id, {
                                                metadata: {
                                                    ...meta,
                                                    mae: currentMae,
                                                    mfe: currentMfe,
                                                    duration_candles: nextDuration
                                                }
                                            });
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
                                                if (exitR === 'TP') soundService.playTP();
                                                else if (exitR === 'SL') soundService.playSL();
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
                                const realMetrics = ContextCollector.captureEntryContext(strategy, candles, symbol);
                                const mMetrics = {
                                    spread: realMetrics.spread_at_entry || 2,
                                    volatility: realMetrics.volatility_atr || 0,
                                    trendStrength: realMetrics.mtf?.h1_trend === 'UP' ? 30 : 10,
                                    rsi: realMetrics.indicators_snapshot['RSI[14]'] || 50,
                                    session: realMetrics.session
                                };

                                let final = AiManager.processSignal(signal, mMetrics);
                                if (!final) {
                                    console.warn(`[Runner] ${strategy.name} signal rejected by AiManager heuristics.`);
                                    continue;
                                }

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
                                            const metrics = ContextCollector.captureEntryContext(strategy, candles, symbol);

                                            // Map to AiAnalyzer expected format
                                            const aiMetrics = {
                                                spread: metrics.spread_at_entry || 0,
                                                volatility: metrics.volatility_atr || 0,
                                                trendStrength: metrics.mtf?.h1_trend === 'UP' ? 30 : 10,
                                                rsi: metrics.indicators_snapshot['RSI[14]'] || 50,
                                                session: metrics.session
                                            };

                                            let aiResult = null;

                                            // ONLY run AI analysis if AI Guard is ON
                                            if (strategy.aiGuard) {
                                                console.log(`[AI Guard] Active. Starting automated audit for ${strategy.name} on ${symbol}...`);
                                                toast.info(`AI is auditing ${strategy.name} signal...`, { icon: '🧠' });
                                                soundService.playAIThinking();

                                                const ai = await AiAnalyzer.analyzeSignal(strategy, final!, aiMetrics, stats, AnalysisType.PRE_TRADE);
                                                aiResult = ai;

                                                console.log(`[AI Audit] Complete for ${strategy.name}: ${ai.confidence}% Confidence`);

                                                // Update the signal in store once AI responds
                                                const store = useStrategyStore.getState();
                                                const latestSignals = store.signals;
                                                const sigIndex = latestSignals.findIndex(s => s.symbol === symbol && s.timestamp === final!.timestamp);
                                                if (sigIndex !== -1) {
                                                    const updatedSig = { ...latestSignals[sigIndex], aiAnalysis: ai };
                                                    store.updateSignal(sigIndex, updatedSig);
                                                }

                                                // Update the position confidence
                                                if (ai.confidence) {
                                                    const latestPos = store.virtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed');
                                                    if (latestPos) {
                                                        store.updateVirtualPosition(latestPos.id, { confidence: ai.confidence });
                                                    }
                                                }
                                            } else {
                                                console.log(`[AI Guard] OFF for ${strategy.name}. Skipping AI analysis.`);
                                            }

                                            // Always log the trade, even if AI was skipped
                                            await TradeLogger.logEntry({ ...final!, aiAnalysis: aiResult }, aiMetrics);
                                        } catch (err) {
                                            console.error('[Runner] Background tasks failed:', err);
                                            toast.error("AI Audit failed for live signal");
                                        }
                                    })();

                                    const side = final.type as 'BUY' | 'SELL';
                                    const pip = getPriceOffset(symbol);
                                    const sl = RiskCalculator.calculateLevel(strategy.risk.sl, 'sl', side, candles, lastCandle.close, pip);
                                    const tp = RiskCalculator.calculateLevel(strategy.risk.tp, 'tp', side, candles, lastCandle.close, pip, lastCandle.close);
                                    const bal = strategy.executionMode === 'real' ? (Object.values(useMarketStore.getState().accounts)[0]?.balance || 10000) : store.virtualBalance;
                                    const lot = RiskCalculator.calculateLot(strategy.risk.lotSize, sl, lastCandle.close, bal, symbol);

                                    const pId = `v-${Date.now()}`;
                                    const isMkt = strategy.entryType === 'market';
                                    const entryP = isMkt ? lastCandle.close : (side === 'BUY' ? lastCandle.high + (pip * 3) : lastCandle.low);

                                    store.addVirtualPosition({
                                        id: pId,
                                        strategyId: strategy.id,
                                        symbol,
                                        type: side,
                                        entryPrice: entryP,
                                        sl: Number(sl.toFixed(5)), // Prevent long decimals
                                        tp: Number(tp.toFixed(5)),
                                        lotSize: lot,
                                        timestamp: Date.now(),
                                        status: isMkt ? 'open' : 'pending',
                                        metadata: final.context,
                                        confidence: final.confidence
                                    });

                                    if (side === 'BUY') soundService.playBuy();
                                    else soundService.playSell();

                                    if (strategy.executionMode === 'real') sendMessage({ topic: 'mt5_command', command: 'order', symbol, is_market: isMkt, type: isMkt ? side.toLowerCase() : (side === 'BUY' ? 'buy_stop' : 'sell_stop'), price: entryP, volume: lot, sl, tp, magic: strategy.magic || 0, comment: strategy.comment || 'Web' });
                                    store.updateLastSignalTime(strategy.id, lastTime);
                                } else {
                                    // Background Update
                                    const activePos = currentVirtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed');
                                    TradeLogger.updateExit(strategy.id, symbol, final.price, activePos?.metadata).catch(e => console.error(e));

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
