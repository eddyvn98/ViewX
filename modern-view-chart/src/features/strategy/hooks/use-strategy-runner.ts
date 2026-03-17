import { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '../store/strategy-store';
import { RuleEngine, EngineContext } from '../logic/RuleEngine';
import { useWebSocket } from '@/hooks/use-websocket';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { soundService } from '../logic/SoundService';
import { backgroundService } from '../logic/BackgroundService';
import type { Candle } from '@/lib/store/types';
import { capturePostExitContexts } from './runner/background-jobs';
import { managePositionOnTick } from './runner/position-management';
import { processStrategySignal } from './runner/signal-flow';
import { getLegacyStrategyPatch, resolveWarmupDataKey, shouldTriggerWarmup } from './runner/warmup';
import type { Strategy } from '../types';
import { buildMatrixRunnerConfigs } from '../dashboard/matrix-cell-state';
import { chartIntervalToDashboardTf } from '../dashboard/matrix-utils';
import { buildMatrixScopeKey } from '../utils/matrix-scope';

type TabsLike = Record<string, { charts: Record<string, { symbol: string; interval?: string; source?: string }>; activeChartId?: string | null }>;

export function useStrategyRunner() {
    const {
        strategies,
        updateStrategy,
        lastResetTime,
        matrixScanners
    } = useStrategyStore();
    const { sendMessage } = useWebSocket();
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const positions = useMarketStore((state) => state.positions);

    const lastProcessedTimeRef = useRef<Record<string, number>>({});
    const lastBarTimeRef = useRef<Record<string, number>>({});
    const isRunningRef = useRef(false);
    const backtestRunRef = useRef<Record<string, number>>({});
    const [isStrategyStoreHydrated, setIsStrategyStoreHydrated] = useState<boolean>(() => {
        const persistApi = (useStrategyStore as unknown as { persist?: { hasHydrated?: () => boolean } }).persist;
        return persistApi?.hasHydrated?.() ?? true;
    });

    const runBacktest = useStrategyStore((state) => state.runBacktest);

    useEffect(() => {
        const persistApi = (useStrategyStore as unknown as {
            persist?: {
                onFinishHydration?: (cb: () => void) => () => void;
                hasHydrated?: () => boolean;
            };
        }).persist;

        if (!persistApi) {
            setIsStrategyStoreHydrated(true);
            return;
        }

        if (persistApi.hasHydrated?.()) {
            setIsStrategyStoreHydrated(true);
            return;
        }

        const unsub = persistApi.onFinishHydration?.(() => {
            setIsStrategyStoreHydrated(true);
        });
        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, []);

    useEffect(() => {
        backtestRunRef.current = {};
    }, [lastResetTime]);

    // 1. Effect for patches and warmups - Throttled or check-based
    useEffect(() => {
        if (!isStrategyStoreHydrated) return;
        const runWarmup = async () => {
            strategies.forEach((strategy: Strategy) => {
                const patch = getLegacyStrategyPatch(strategy);
                if (patch) updateStrategy(strategy.id, patch);

                if (!strategy.active) {
                    if (backtestRunRef.current[strategy.id]) delete backtestRunRef.current[strategy.id];
                }
            });

            const currentCandleData = useMarketStore.getState().candleData;
            const currentVirtualPositions = useStrategyStore.getState().virtualPositions;
            const currentTabs = useMarketStore.getState().tabs as TabsLike;

            const effectiveConfigs = buildMatrixRunnerConfigs(matrixScanners);
            
            if (effectiveConfigs.length > 0) {
                effectiveConfigs.forEach((config) => {
                    const scopeKey = buildMatrixScopeKey(config.strategyId, config.symbol, config.timeframe);
                    const candles = currentCandleData[`${config.source}:${config.symbol}:${config.interval}`];
                    if (!candles || candles.length < 50) return;

                    const strategy = strategies.find((item) => item.id === config.strategyId);
                    if (!strategy) return;

                    const lastRun = backtestRunRef.current[scopeKey] || 0;
                    const hasActivePos = currentVirtualPositions.some((p) => p.matrixScopeKey === scopeKey && p.status !== 'closed' && !p.isHistorical);
                    const hasHistoricalPos = currentVirtualPositions.some((p) => p.matrixScopeKey === scopeKey && p.isHistorical);
                    if (!shouldTriggerWarmup(lastRun, hasActivePos, hasHistoricalPos)) return;

                    backtestRunRef.current[scopeKey] = Date.now();
                    void runBacktest(strategy.id, [...candles], config.symbol, config.timeframe, config.source, scopeKey);
                });
            } else {
                strategies.forEach((strategy: Strategy) => {
                    if (!strategy.active) return;
                    const activeTab = activeTabId ? currentTabs[activeTabId] : null;
                    const dataKey = resolveWarmupDataKey(strategy, currentCandleData, activeTab);
                    if (!dataKey || !currentCandleData[dataKey] || currentCandleData[dataKey].length < 50) return;

                    const lastRun = backtestRunRef.current[strategy.id] || 0;
                    const hasActivePos = currentVirtualPositions.some((p) => p.strategyId === strategy.id && p.status !== 'closed');
                    const hasHistoricalPos = currentVirtualPositions.some((p) => p.strategyId === strategy.id && p.isHistorical);

                    if (!shouldTriggerWarmup(lastRun, hasActivePos, hasHistoricalPos)) return;

                    const parts = dataKey.split(':');
                    const actualSymbol = strategy.symbol || (parts.length >= 2 ? parts[1] : 'BACKTEST');
                    backtestRunRef.current[strategy.id] = Date.now();
                    void runBacktest(strategy.id, [...currentCandleData[dataKey]], actualSymbol, strategy.timeframe, 'MT5');
                });
            }
        };

        runWarmup();
        // Run warmup/patch check every 5 seconds instead of every candle update
        const timer = setInterval(runWarmup, 5000);
        return () => clearInterval(timer);
    }, [isStrategyStoreHydrated, strategies, matrixScanners, activeTabId, lastResetTime, updateStrategy, runBacktest]);

    // 2. Effect for background service
    useEffect(() => {
        if (!isStrategyStoreHydrated) return;
        const activeCount = matrixScanners.filter((scanner) => scanner.active && scanner.strategyId).length;
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
    }, [isStrategyStoreHydrated, matrixScanners]);

    // 3. Main Strategy Runner Loop - Interval based (1s) to prevent UI flooding
    useEffect(() => {
        if (!isStrategyStoreHydrated) return;
        const runCycle = async () => {
            if (isRunningRef.current) return;
            isRunningRef.current = true;
            
            try {
                const currentCandleData = useMarketStore.getState().candleData;
                const effectiveConfigs = buildMatrixRunnerConfigs(matrixScanners);
                if (effectiveConfigs.length === 0) {
                    isRunningRef.current = false; // Ensure reset if no configs
                    return;
                }

                for (const config of effectiveConfigs) {
                    const { symbol, interval, source, strategyId, timeframe } = config;
                    const normalizedSymbol = normalizeSymbol(symbol);
                    const pairKey = `${source}:${normalizedSymbol}:${interval}`;
                    const candles = currentCandleData[pairKey];

                    if (!candles || candles.length < 5) continue;

                    const strategy = strategies.find((s) => s.id === strategyId);
                    if (!strategy) continue;
                    
                    const scopeKey = buildMatrixScopeKey(strategy.id, normalizedSymbol, timeframe || chartIntervalToDashboardTf(interval));
                    const processKey = `${strategy.id}:${symbol}:${interval}`;
                    
                    // Throttle per-strategy processing to max once per second
                    if (Date.now() - (lastProcessedTimeRef.current[processKey] || 0) < 1000) continue;
                    lastProcessedTimeRef.current[processKey] = Date.now();

                    try {
                        const lastCandle = candles[candles.length - 1] as Candle;
                        const rawTime = lastCandle.time as unknown;
                        const lastTime = typeof rawTime === 'object' ? Number((rawTime as { timestamp?: number }).timestamp || 0) : Number(rawTime);
                        
                        // Robust Bar Detection: If lastBarTimeRef[processKey] is undefined, it's the first tick.
                        // Record the time but don't mark it as "new bar" to prevent execution on mount for the CURRENT bar.
                        const previousBarTime = lastBarTimeRef.current[processKey];
                        const isNewBar = previousBarTime !== undefined && lastTime > previousBarTime;
                        lastBarTimeRef.current[processKey] = lastTime;

                        const store = useStrategyStore.getState();
                        const strategyPositions = store.virtualPositions.filter(
                            (p) =>
                                p.strategyId === strategy.id &&
                                p.symbol === symbol &&
                                p.status !== 'closed' &&
                                ((!p.matrixScopeKey && !scopeKey) || p.matrixScopeKey === scopeKey)
                        );

                        strategyPositions.forEach((position) => {
                            managePositionOnTick(
                                strategy,
                                position,
                                symbol,
                                candles,
                                lastCandle,
                                isNewBar,
                                store,
                                sendMessage as (data: unknown) => void
                            );
                        });

                        const latestStore = useStrategyStore.getState();
                        const latestVirtualPositions = latestStore.virtualPositions;

                        if (!isNewBar) {
                            capturePostExitContexts(strategy, symbol, candles, latestVirtualPositions, latestStore.updateVirtualPosition);
                            continue;
                        }

                        const engineCtx: EngineContext = {
                            activePositions: latestVirtualPositions,
                            currentPrice: lastCandle.close,
                            symbol,
                            lastSignalTime: strategy.lastSignalTime
                        };

                        const signal = RuleEngine.run(strategy, candles, engineCtx);
                        if (!signal) continue;
                        
                        // Scoped Signal Guard: Prevent duplicate signals for the same bar/scope
                        const lastSignalTime = scopeKey ? latestStore.scopedLastSignalTimes[scopeKey] : strategy.lastSignalTime;
                        if (typeof lastSignalTime === 'number' && lastTime <= lastSignalTime) continue;

                        processStrategySignal(
                            strategy,
                            signal,
                            symbol,
                            timeframe || chartIntervalToDashboardTf(interval),
                            candles,
                            lastCandle,
                            latestVirtualPositions,
                            latestStore,
                            lastTime,
                            source,
                            scopeKey
                        );
                    } catch (strategyError) {
                        console.error(`[Runner] Strategy ${strategy.name} error:`, strategyError);
                    }
                }
            } catch (fatalErr) {
                console.error('[Runner] FATAL Error in loop:', fatalErr);
            } finally {
                isRunningRef.current = false;
            }
        };

        const intervalId = setInterval(runCycle, 1000);
        return () => clearInterval(intervalId);
    }, [isStrategyStoreHydrated, matrixScanners, strategies, positions, sendMessage]);
}
