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

export function useStrategyRunner() {
    const {
        strategies,
        addSignal,
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

    useEffect(() => {
        console.log(`[Store] Total Strategies: ${strategies.length}`);
        strategies.forEach(s => console.log(`  > ${s.name} (${s.id}) | Active: ${s.active} | Sym: ${s.symbol}`));
    }, [strategies.length, strategies]); // Log on change

    useEffect(() => {
        // Run strategies for all symbols currently open in any tab
        Object.values(tabs).forEach(tab => {
            Object.values(tab.charts).forEach(async (chart) => {
                const symbol = chart.symbol;
                const interval = chart.interval || '1m';
                const source = chart.source || 'default';
                const normSymbol = normalizeSymbol(symbol);
                const key = `${source}:${normSymbol}:${interval}`;

                const candles = candleData[key];

                if (Date.now() % 10000 < 500) {
                    console.log(`[Engine] Loop: Symbol=${symbol}, Key=${key}, Candles=${candles?.length || 0}`);
                }

                if (!candles || candles.length < 5) {
                    if (Math.random() < 0.01) console.log(`[Engine] Skipping ${key}: Insufficient candles (${candles?.length})`);
                    return;
                }

                const lastCandle = candles[candles.length - 1];
                const lastTime = typeof lastCandle.time === 'object' ? (lastCandle.time as any).timestamp : Number(lastCandle.time);

                if (Date.now() % 5000 < 200) {
                    console.log(`[Data] ${symbol} LastCandle: Time=${new Date(lastTime * 1000).toLocaleTimeString()} Close=${lastCandle.close}`);
                }

                const activeStrategies = strategies.filter(s => {
                    if (!s.active) return false;
                    if (!s.symbol) return true;
                    // Relaxed comparison
                    const isMatch = normalizeSymbol(s.symbol) === normSymbol;
                    if (!isMatch && Date.now() % 5000 < 200) {
                        console.log(`[Engine] Skipping ${s.name} (${s.symbol}) - Mismatch with Chart (${symbol})`);
                    }
                    return isMatch;
                });

                if (activeStrategies.length > 0 && Date.now() % 2000 < 200) {
                    console.log(`[Engine] Running ${activeStrategies.length} strategies for ${symbol} (Norm: ${normSymbol})`);
                    activeStrategies.forEach(s => console.log(` - Strategy: ${s.name} (${s.id}) for ${s.symbol}`));
                }

                activeStrategies.forEach(async (strategy) => {
                    const processKey = `${strategy.id}:${symbol}`;

                    const lastProcessed = lastProcessedTimeRef.current[processKey];
                    if (Date.now() - (lastProcessed || 0) < 1000) return; // 1s throttle
                    lastProcessedTimeRef.current[processKey] = Date.now();

                    // --- VIRTUAL EXECUTION ENGINE ---
                    // 1. Manage OPEN positions (SL/TP & Trailing)
                    const strategyPositions = virtualPositions.filter(p => p.strategyId === strategy.id && p.symbol === symbol);

                    if (strategyPositions.length > 0 && Date.now() % 2000 < 200) {
                        console.log(`[Engine] Managing ${strategyPositions.length} positions for ${strategy.name}`);
                    }

                    strategyPositions.forEach(pos => {
                        if (pos.status === 'open') {
                            const currentPrice = lastCandle.close; // In real engine, use bid/ask

                            // DEBUG LOG for SL/TP
                            if (Date.now() % 2000 < 100) {
                                console.log(`[Pos] ${pos.id} (${pos.type}) Price=${currentPrice} SL=${pos.sl} TP=${pos.tp}`);
                            }

                            // --- TRAILING STOP LOGIC ---
                            if (strategy.risk.trailing && strategy.risk.trailingSource) {
                                // Calculate HA for latest closed candle (index -1 in live array usually current, so maybe -2 for closed? 
                                // Actually 'candles' usually has the latest open candle at end. 
                                // The bot uses "Last Closed Candle".
                                // If candles[last] is current open candle, we need component -2.
                                // NOTE: In this system usually candles[last] is the LIVE candle (shifting).
                                // So safely use -2 for "Last Closed".
                                const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, candles.slice(0, -1)); // -1 to exclude live? Or just use index logic
                                const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, candles.slice(0, -1));

                                // Wait, IndicatorCalculator.getLastValue gets the LAST one.
                                // If we pass candles.slice(0, -1), we get value for the closed candle.
                                // CORRECT.

                                let newSl = pos.sl;
                                let shouldUpdate = false;

                                if (pos.type === 'BUY' && strategy.risk.trailingSource === 'HA_Low') {
                                    if (haLow > pos.sl + 0.1) { // Threshold 0.1
                                        newSl = haLow;
                                        shouldUpdate = true;
                                    }
                                } else if (pos.type === 'SELL' && strategy.risk.trailingSource === 'HA_High') {
                                    // Sell SL should go DOWN. 
                                    const proposedSl = haHigh + 0.3; // Bot adds 0.3 offset
                                    if (pos.sl === 0 || proposedSl < pos.sl - 0.1) {
                                        newSl = proposedSl;
                                        shouldUpdate = true;
                                    }
                                }

                                if (shouldUpdate) {
                                    updateVirtualPosition(pos.id, { sl: newSl });
                                    if (Date.now() % 5000 < 500) {
                                        console.log(`[Trailing] Updated ${pos.id} SL: ${pos.sl} -> ${newSl}`);
                                        toast.info(`Trailing SL Updated`, { description: `${pos.symbol}: ${pos.sl.toFixed(2)} -> ${newSl.toFixed(2)}` });
                                    }
                                    // TODO: Sync with Real MT5 if enabled
                                }
                            }

                            // --- EXIT LOGIC ---
                            let exitPrice = null;
                            let exitReason = '';

                            if (pos.type === 'BUY') {
                                if (pos.sl && currentPrice <= pos.sl) { exitPrice = pos.sl; exitReason = 'SL'; }
                                else if (pos.tp && currentPrice >= pos.tp) { exitPrice = pos.tp; exitReason = 'TP'; }
                            } else { // SELL
                                if (pos.sl && currentPrice >= pos.sl) { exitPrice = pos.sl; exitReason = 'SL'; }
                                else if (pos.tp && currentPrice <= pos.tp) { exitPrice = pos.tp; exitReason = 'TP'; }
                            }

                            if (exitPrice) {
                                // Close the position
                                const pnl = (exitPrice - pos.entryPrice) * (pos.type === 'BUY' ? 1 : -1) * (pos.lotSize * 100000); // Simple Forex PnL approx
                                // We use the store action which handles status update and PnL
                                closeVirtualPosition(strategy.id, symbol, exitPrice);

                                toast.warning(`[${exitReason}] ${pos.symbol} Closed @ ${exitPrice}`, {
                                    description: `PnL: $${pnl.toFixed(2)}`
                                });

                                // Real Mode Sync (if needed)
                                if (strategy.executionMode === 'real') {
                                    // MT5 usually handles SL/TP on server side, so we might not need to send close command
                                    // unless we are doing manual trailing or hidden SL/TP.
                                    // For now, assume MT5 handles it, or we just sync the UI.
                                }
                            }
                        } else if (pos.status === 'pending') {
                            // 2. Manage PENDING orders (Fill)
                            const currentPrice = lastCandle.close;
                            let shouldFill = false;

                            if (pos.type === 'BUY') {
                                // Buy Stop: Price crosses UP entry price
                                if (currentPrice >= pos.entryPrice) shouldFill = true;
                                // Buy Limit (future feature): Price crosses DOWN entry price
                            } else { // SELL
                                // Sell Stop: Price crosses DOWN entry price
                                if (currentPrice <= pos.entryPrice) shouldFill = true;
                            }

                            if (shouldFill) {
                                // Convert to OPEN
                                const { updateVirtualPosition } = useStrategyStore.getState(); // Access directly to avoid dependency cycle if strict
                                updateVirtualPosition(pos.id, { status: 'open', entryPrice: pos.entryPrice, timestamp: Date.now() }); // Keep original entry price or Use current? keeping original for now

                                toast.success(`[FILLED] ${pos.type} ${pos.symbol} @ ${pos.entryPrice}`);
                            }
                        }
                    });
                    // --------------------------------

                    const context: EngineContext = {
                        activePositions: positions,
                        currentPrice: lastCandle.close,
                        symbol,
                        lastSignalTime: strategy.lastSignalTime
                    };

                    const signal = RuleEngine.run(strategy, candles, context);

                    if (signal) {
                        console.log(`[Engine] ${strategy.name} TRIGGERED signal:`, signal);
                    }

                    if (signal) {
                        const mockMetrics: MarketMetrics = {
                            spread: 2,
                            volatility: 30,
                            trendStrength: 25,
                            rsi: 50,
                            session: "London" // In real use, detect from timestamp
                        };

                        // 1. Initial heuristic filter
                        let finalSignal = AiManager.processSignal(signal, mockMetrics);

                        if (finalSignal) {
                            // 2. Heavy AI Analysis for ENTRY
                            if (finalSignal.type !== 'EXIT') {
                                const stats = await StatsService.compute(strategy.id);
                                const aiAnalysis = await AiAnalyzer.analyzeSignal(strategy.id, finalSignal, mockMetrics, stats);
                                finalSignal = { ...finalSignal, aiAnalysis };

                                // Log Entry
                                await TradeLogger.logEntry(finalSignal, mockMetrics);

                                // Real MT5 Execution
                                // Entry Logic
                                const entryType = strategy.entryType || 'market';
                                const side = finalSignal.type as 'BUY' | 'SELL';

                                // Calculate prices like MT5 Bot
                                const offset = symbol.includes('XAU') ? 0.3 : (symbol.includes('JPY') ? 0.01 : 0.0001);

                                const haCandles = candles.slice(0, -1); // Use closed candles for calculation
                                const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, haCandles);
                                const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, haCandles);

                                const stopPrice = side === 'BUY' ? lastCandle.high + offset : lastCandle.low - offset;

                                // DYNAMIC SL LOGIC
                                let slPrice = 0;
                                if (strategy.risk.slSource === 'HA_Low') {
                                    slPrice = haLow;
                                } else if (strategy.risk.slSource === 'HA_High') {
                                    slPrice = haHigh + 0.3; // Bot adds 0.3 offset for Sell SL
                                } else {
                                    // Fallback to fixed pips
                                    slPrice = side === 'BUY' ? lastCandle.close - (strategy.risk.sl * offset * 0.1) : lastCandle.close + (strategy.risk.sl * offset * 0.1);
                                }


                                const tpPrice = side === 'BUY' ? lastCandle.close + (strategy.risk.tp * offset * 0.1) : lastCandle.close - (strategy.risk.tp * offset * 0.1);

                                if (entryType === 'market') {
                                    // Existing Market Entry Logic
                                    const position: VirtualPosition = {
                                        id: `v-${Date.now()}`,
                                        strategyId: strategy.id,
                                        symbol: symbol,
                                        type: side,
                                        entryPrice: lastCandle.close,
                                        sl: slPrice,
                                        tp: tpPrice,
                                        lotSize: strategy.risk.lotSize || 0.01,
                                        timestamp: Date.now(),
                                        status: 'open'
                                    };
                                    addVirtualPosition(position);
                                    if (strategy.executionMode === 'real') {
                                        sendMessage({
                                            topic: 'mt5_command',
                                            command: 'order',
                                            symbol,
                                            is_market: true,
                                            type: side.toLowerCase(),
                                            volume: strategy.risk.lotSize || 0.01,
                                            sl: position.sl,
                                            tp: position.tp,
                                            magic: strategy.magic || 0,
                                            comment: strategy.comment || 'WebEngine'
                                        });
                                    }
                                } else { // entryType === 'stop'
                                    // Stop Order Entry Logic
                                    const position: VirtualPosition = {
                                        id: `v-${Date.now()}`,
                                        strategyId: strategy.id,
                                        symbol: symbol,
                                        type: side,
                                        entryPrice: stopPrice,
                                        sl: slPrice,
                                        tp: tpPrice,
                                        lotSize: strategy.risk.lotSize || 0.01,
                                        timestamp: Date.now(),
                                        status: 'pending'
                                    };
                                    addVirtualPosition(position);
                                    if (strategy.executionMode === 'real') {
                                        sendMessage({
                                            topic: 'mt5_command',
                                            command: 'order',
                                            symbol,
                                            is_market: false,
                                            type: side === 'BUY' ? 'buy_stop' : 'sell_stop',
                                            price: stopPrice,
                                            volume: strategy.risk.lotSize || 0.01,
                                            sl: slPrice,
                                            tp: tpPrice,
                                            magic: strategy.magic || 0,
                                            comment: strategy.comment || 'WebEngine'
                                        });
                                    }
                                }
                                updateLastSignalTime(strategy.id, lastTime);
                            } else { // finalSignal.type === 'EXIT'
                                // Log Exit
                                await TradeLogger.updateExit(strategy.id, symbol, finalSignal.price);

                                // Exit/Cancel Logic
                                const pendingForThis = virtualPositions.find(p => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
                                if (pendingForThis) {
                                    cancelVirtualPosition(strategy.id, symbol);
                                    if (strategy.executionMode === 'real') {
                                        // MT5 Cancel logic (assuming bridge supports remove by magic or order ID)
                                        // For now, using close_by_magic as a placeholder for cancelling pending orders
                                        sendMessage({
                                            topic: 'mt5_command',
                                            command: 'close_by_magic', // Or a dedicated remove_order command
                                            symbol,
                                            magic: strategy.magic || 0
                                        });
                                    }
                                } else {
                                    // Close Real Positions by Magic (if supported)
                                    if (strategy.executionMode === 'real') {
                                        sendMessage({
                                            topic: 'mt5_command',
                                            command: 'close_by_magic',
                                            symbol: symbol,
                                            magic: strategy.magic || 0
                                        });
                                    }
                                    // Close Virtual Position
                                    closeVirtualPosition(strategy.id, symbol, finalSignal.price);
                                }
                            }

                            // 3. Dispatch & Notify
                            addSignal(finalSignal);
                            // updateLastSignalTime is now handled within the entry block
                            lastProcessedTimeRef.current[processKey] = Date.now();

                            const title = finalSignal.type === "EXIT" ? "Strategy Exit" : "Strategy Entry";
                            const description = finalSignal.aiAnalysis
                                ? `AI Confidence: ${finalSignal.aiAnalysis.confidence}% | Risk: ${finalSignal.aiAnalysis.riskLevel}`
                                : `Price: ${finalSignal.price}`;

                            toast.info(`${title}: ${finalSignal.type} ${finalSignal.symbol}`, {
                                description,
                                duration: 8000,
                            });
                        }
                    }
                });
            });
        });
    }, [candleData, tabs, strategies, positions]);
}
