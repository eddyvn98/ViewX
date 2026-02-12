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
        });

        console.log(`[Store] Total Strategies: ${strategies.length}`);
        strategies.forEach(s => console.log(`  > ${s.name} (${s.id}) | Active: ${s.active} | Sym: ${s.symbol}`));
    }, [strategies.length, strategies]); // Log on change


    useEffect(() => {
        // Prevent concurrent executions of the heavy runner loop
        if (isRunningRef.current) return;
        isRunningRef.current = true;

        // 1. Collect unique symbol/interval pairs from all tabs/charts
        const uniqueKeys = new Set<string>();
        const uniqueChartConfigs: { symbol: string; interval: string; source: string }[] = [];

        Object.values(tabs).forEach(tab => {
            Object.values(tab.charts).forEach(chart => {
                const symbol = chart.symbol;
                const interval = chart.interval || '1m';
                const source = chart.source || 'default';
                const key = `${source}:${normalizeSymbol(symbol)}:${interval}`;

                if (!uniqueKeys.has(key)) {
                    uniqueKeys.add(key);
                    uniqueChartConfigs.push({ symbol, interval, source });
                }
            });
        });

        // 2. Run strategies for each unique pair
        const runEachPair = async () => {
            try {
                for (const config of uniqueChartConfigs) {
                    const { symbol, interval, source } = config;
                    const normSymbol = normalizeSymbol(symbol);
                    const key = `${source}:${normSymbol}:${interval}`;
                    const candles = candleData[key];

                    if (!candles || candles.length < 5) continue;

                    const lastCandle = candles[candles.length - 1];
                    const lastTime = typeof lastCandle.time === 'object' ? (lastCandle.time as any).timestamp : Number(lastCandle.time);

                    const activeStrategies = strategies.filter(s => {
                        if (!s.active) return false;
                        const symbolMatch = !s.symbol || normalizeSymbol(s.symbol) === normSymbol;
                        const timeframeMatch = !s.timeframe || s.timeframe === interval;
                        return symbolMatch && timeframeMatch;
                    });

                    if (activeStrategies.length === 0) continue;

                    // Process strategies SEQUENTIALLY to prevent race conditions
                    for (const strategy of activeStrategies) {
                        const processKey = `${strategy.id}:${symbol}`;

                        const lastProcessed = lastProcessedTimeRef.current[processKey];
                        // Throttling: only run once every 1s per strategy/symbol
                        if (Date.now() - (lastProcessed || 0) < 1000) continue;
                        lastProcessedTimeRef.current[processKey] = Date.now();

                        // --- BAR CLOSE DETECTION ---
                        const isNewBar = lastTime > (lastBarTimeRef.current[processKey] || 0);
                        if (isNewBar) {
                            lastBarTimeRef.current[processKey] = lastTime;
                            // console.log(`[StrategyRunner] NEW BAR detected for ${strategy.name} on ${symbol}: ${new Date(lastTime).toLocaleTimeString()}`);
                        }

                        const latestVirtualPositions = useStrategyStore.getState().virtualPositions;
                        const strategyPositions = latestVirtualPositions.filter(p => p.strategyId === strategy.id && p.symbol === symbol);

                        // 1. PROTECTION LOGIC (Fast Track - Runs every ticker/1s)
                        strategyPositions.forEach(pos => {
                            if (pos.status === 'open') {
                                const currentPrice = lastCandle.close;

                                // --- TRAILING STOP LOGIC ---
                                if (strategy.risk.trailing && strategy.risk.trailingSource) {
                                    const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, candles.slice(0, -1));
                                    const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, candles.slice(0, -1));

                                    const priceOffset = symbol.includes('XAU') ? 0.3 : (symbol.includes('JPY') ? 0.01 : 0.0001);
                                    const moveThreshold = symbol.includes('XAU') ? 0.1 : (priceOffset * 0.1);

                                    let newSl = pos.sl;
                                    let shouldUpdate = false;

                                    // Debug Trailing Check
                                    // if (Math.random() < 0.05) console.log(`[Trailing] Checking ${pos.symbol} ${pos.type}. SL: ${pos.sl}, HALow: ${haLow}, HAHigh: ${haHigh}, Threshold: ${moveThreshold}`);

                                    if (pos.type === 'BUY' && strategy.risk.trailingSource === 'HA_Low') {
                                        if (haLow > pos.sl + moveThreshold) {
                                            newSl = haLow;
                                            shouldUpdate = true;
                                            console.log(`[Trailing] BUY Upgrade proposed: ${pos.sl} -> ${newSl} (Price: ${currentPrice})`);
                                        }
                                    } else if (pos.type === 'SELL' && strategy.risk.trailingSource === 'HA_High') {
                                        const proposedSl = haHigh + priceOffset;
                                        if (pos.sl === 0 || proposedSl < pos.sl - moveThreshold) {
                                            newSl = proposedSl;
                                            shouldUpdate = true;
                                            console.log(`[Trailing] SELL Upgrade proposed: ${pos.sl} -> ${newSl} (Price: ${currentPrice})`);
                                        }
                                    }

                                    if (shouldUpdate) {
                                        // SAFEGUARD: Don't move SL to a point where it immediately stops out the position
                                        // unless the price is clearly against us.
                                        const isSafe = pos.type === 'BUY' ? newSl < currentPrice : newSl > currentPrice;
                                        if (isSafe) {
                                            updateVirtualPosition(pos.id, { sl: newSl });
                                            console.log(`[Trailing] SL Updated for ${pos.symbol}: ${newSl}`);
                                        } else {
                                            console.warn(`[Trailing] Safeguard Blocked! Current: ${currentPrice}, Proposed SL: ${newSl}, Type: ${pos.type}`);
                                        }
                                    }

                                }

                                // --- EXIT LOGIC ---
                                // FIX: Prevent immediate exit on same candle (within 5s)
                                if (Date.now() - pos.timestamp < 5000) return;

                                let exitPrice = null;
                                let exitReason = '';
                                if (pos.type === 'BUY') {
                                    if (pos.sl && currentPrice <= pos.sl) { exitPrice = pos.sl; exitReason = 'SL'; }
                                    else if (pos.tp && currentPrice >= pos.tp) { exitPrice = pos.tp; exitReason = 'TP'; }
                                } else {
                                    if (pos.sl && currentPrice >= pos.sl) { exitPrice = pos.sl; exitReason = 'SL'; }
                                    else if (pos.tp && currentPrice <= pos.tp) { exitPrice = pos.tp; exitReason = 'TP'; }
                                }

                                if (exitPrice) {
                                    console.log(`[StrategyRunner] EXIT TRIGGERED: ${pos.symbol} ${pos.type} | Reason: ${exitReason} | Price: ${currentPrice} | Trigger: ${exitPrice}`);
                                    closeVirtualPosition(strategy.id, symbol, exitPrice);
                                    toast.warning(`[${exitReason}] ${pos.symbol} Closed @ ${exitPrice}`);
                                }
                            } else if (pos.status === 'pending') {
                                const currentPrice = lastCandle.close;
                                let shouldFill = false;
                                if (pos.type === 'BUY') {
                                    if (currentPrice >= pos.entryPrice) shouldFill = true;
                                } else {
                                    if (currentPrice <= pos.entryPrice) shouldFill = true;
                                }

                                if (shouldFill) {
                                    updateVirtualPosition(pos.id, { status: 'open', entryPrice: pos.entryPrice, timestamp: Date.now() });
                                    toast.success(`[FILLED] ${pos.type} ${pos.symbol} @ ${pos.entryPrice}`);
                                }
                            }
                        });

                        // 2. SIGNAL LOGIC (Slow Track - ONLY runs on BAR CLOSE)
                        if (!isNewBar) continue;

                        const context: EngineContext = {
                            activePositions: [...positions, ...latestVirtualPositions],
                            currentPrice: lastCandle.close,
                            symbol,
                            lastSignalTime: strategy.lastSignalTime
                        };

                        const signal = RuleEngine.run(strategy, candles, context);

                        if (signal) {
                            const mockMetrics: MarketMetrics = {
                                spread: 2, volatility: 30, trendStrength: 25, rsi: 50, session: "London"
                            };

                            let finalSignal = AiManager.processSignal(signal, mockMetrics);

                            if (finalSignal) {
                                if (finalSignal.type === 'CANCEL') {
                                    const pendingForThis = latestVirtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
                                    if (pendingForThis) {
                                        cancelVirtualPosition(strategy.id, symbol);
                                        if (strategy.executionMode === 'real') {
                                            sendMessage({ topic: 'mt5_command', command: 'close_by_magic', symbol, magic: strategy.magic || 0 });
                                        }
                                        toast.warning(`[CANCELLED] ${strategy.name} pending order on ${symbol}`);
                                    }
                                    continue;
                                }

                                if (finalSignal.type !== 'EXIT') {
                                    // Final Safety Check before entry: Check store again for any new position created while analyzing
                                    const refreshedPositions = useStrategyStore.getState().virtualPositions;
                                    if (refreshedPositions.some(p => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed')) {
                                        console.log(`[Engine] Blocking duplicate entry for ${strategy.name} (Position already exists)`);
                                        continue;
                                    }

                                    const stats = await StatsService.compute(strategy.id);
                                    const aiAnalysis = await AiAnalyzer.analyzeSignal(strategy.id, finalSignal, mockMetrics, stats);
                                    finalSignal = { ...finalSignal, aiAnalysis };

                                    await TradeLogger.logEntry(finalSignal, mockMetrics);

                                    const entryType = strategy.entryType || 'market';
                                    const side = finalSignal.type as 'BUY' | 'SELL';
                                    const pipSize = symbol.includes('XAU') ? 0.1 : (symbol.includes('JPY') ? 0.01 : 0.0001);
                                    const priceOffset = symbol.includes('XAU') ? 0.3 : (symbol.includes('JPY') ? 0.01 : 0.0001);

                                    const haCandles = candles.slice(0, -1);
                                    const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, haCandles);
                                    const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, haCandles);

                                    const stopPrice = side === 'BUY' ? lastCandle.high + priceOffset : lastCandle.low;

                                    // FIX: Log SL/TP calculation for debugging
                                    console.log(`[StrategyRunner] Calculating SL/TP for ${side} on ${symbol}. Price: ${lastCandle.close}, PipSize: ${pipSize}`);

                                    const slPrice = RiskCalculator.calculateLevel(strategy.risk.sl, 'sl', side, candles, lastCandle.close, pipSize);
                                    const tpPrice = RiskCalculator.calculateLevel(strategy.risk.tp, 'tp', side, candles, lastCandle.close, pipSize, lastCandle.close);

                                    // Calculate dynamic lot size
                                    let balance = 10000;
                                    if (strategy.executionMode === 'real') {
                                        const account = Object.values(useMarketStore.getState().accounts)[0];
                                        balance = account?.balance || 10000;
                                    } else {
                                        balance = useStrategyStore.getState().virtualBalance;
                                    }

                                    const finalLot = RiskCalculator.calculateLot(strategy.risk.lotSize, slPrice, lastCandle.close, balance, symbol);

                                    console.log(`[StrategyRunner] SL: ${slPrice}, TP: ${tpPrice}, Lot: ${finalLot} (Mode: ${strategy.executionMode}, Bal: ${balance})`);


                                    if (entryType === 'market') {
                                        const position: VirtualPosition = {
                                            id: `v-${Date.now()}`, strategyId: strategy.id, symbol: symbol, type: side, entryPrice: lastCandle.close, sl: slPrice, tp: tpPrice, lotSize: finalLot, timestamp: Date.now(), status: 'open'
                                        };
                                        addVirtualPosition(position);
                                        if (strategy.executionMode === 'real') {
                                            sendMessage({ topic: 'mt5_command', command: 'order', symbol, is_market: true, type: side.toLowerCase(), volume: finalLot, sl: position.sl, tp: position.tp, magic: strategy.magic || 0, comment: strategy.comment || 'WebEngine' });
                                        }
                                    } else {
                                        const position: VirtualPosition = {
                                            id: `v-${Date.now()}`, strategyId: strategy.id, symbol: symbol, type: side, entryPrice: stopPrice, sl: slPrice, tp: tpPrice, lotSize: finalLot, timestamp: Date.now(), status: 'pending'
                                        };
                                        addVirtualPosition(position);
                                        if (strategy.executionMode === 'real') {
                                            sendMessage({ topic: 'mt5_command', command: 'order', symbol, is_market: false, type: side === 'BUY' ? 'buy_stop' : 'sell_stop', price: stopPrice, volume: finalLot, sl: slPrice, tp: tpPrice, magic: strategy.magic || 0, comment: strategy.comment || 'WebEngine' });
                                        }
                                    }
                                    updateLastSignalTime(strategy.id, lastTime);
                                } else {
                                    await TradeLogger.updateExit(strategy.id, symbol, finalSignal.price);
                                    const pendingForThis = latestVirtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
                                    if (pendingForThis) {
                                        cancelVirtualPosition(strategy.id, symbol);
                                    } else {
                                        closeVirtualPosition(strategy.id, symbol, finalSignal.price);
                                    }
                                    if (strategy.executionMode === 'real') {
                                        sendMessage({ topic: 'mt5_command', command: 'close_by_magic', symbol, magic: strategy.magic || 0 });
                                    }
                                }

                                addSignal(finalSignal);
                                const title = finalSignal.type === "EXIT" ? "Strategy Exit" : (finalSignal.type === "CANCEL" ? "Strategy Cancel" : "Strategy Entry");
                                toast.info(`${title}: ${finalSignal.type} ${finalSignal.symbol}`, { description: `Price: ${finalSignal.price}`, duration: 8000 });
                            }
                        }
                    }
                }
            } finally {
                isRunningRef.current = false;
            }
        };

        runEachPair();
    }, [candleData, tabs, strategies, virtualPositions, positions]);
}
