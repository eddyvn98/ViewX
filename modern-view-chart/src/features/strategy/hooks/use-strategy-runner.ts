import { useEffect, useRef } from 'react';
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
import { normalizeTF } from '../utils/time-utils';

type TabsLike = Record<string, { charts: Record<string, { symbol: string; interval?: string; source?: string }>; activeChartId?: string | null }>;

export function useStrategyRunner() {
    const {
        strategies,
        updateStrategy,
        virtualPositions,
        lastResetTime,
        matrixScanners
    } = useStrategyStore();
    const { sendMessage } = useWebSocket();
    const candleData = useMarketStore((state) => state.candleData);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const tabs = useMarketStore((state) => state.tabs) as TabsLike;
    const positions = useMarketStore((state) => state.positions);

    const lastProcessedTimeRef = useRef<Record<string, number>>({});
    const lastBarTimeRef = useRef<Record<string, number>>({});
    const isRunningRef = useRef(false);
    const backtestRunRef = useRef<Record<string, number>>({});

    const runBacktest = useStrategyStore((state) => state.runBacktest);

    useEffect(() => {
        backtestRunRef.current = {};
    }, [lastResetTime]);

    useEffect(() => {
        strategies.forEach((strategy: Strategy) => {
            const patch = getLegacyStrategyPatch(strategy);
            if (patch) updateStrategy(strategy.id, patch);

            if (!strategy.active) {
                if (backtestRunRef.current[strategy.id]) delete backtestRunRef.current[strategy.id];
                return;
            }

            const activeTab = activeTabId ? tabs[activeTabId] : null;
            const dataKey = resolveWarmupDataKey(strategy, candleData, activeTab);
            if (!dataKey || !candleData[dataKey] || candleData[dataKey].length < 50) return;

            const lastRun = backtestRunRef.current[strategy.id] || 0;
            const hasActivePos = virtualPositions.some((p) => p.strategyId === strategy.id && p.status !== 'closed');
            const hasHistoricalPos = virtualPositions.some((p) => p.strategyId === strategy.id && p.isHistorical);

            if (!shouldTriggerWarmup(lastRun, hasActivePos, hasHistoricalPos)) return;

            const parts = dataKey.split(':');
            const actualSymbol = strategy.symbol || (parts.length >= 2 ? parts[1] : 'BACKTEST');
            backtestRunRef.current[strategy.id] = Date.now();
            runBacktest(strategy.id, [...candleData[dataKey]], actualSymbol);
        });
    }, [strategies, candleData, activeTabId, tabs, runBacktest, updateStrategy, virtualPositions]);

    useEffect(() => {
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
    }, [matrixScanners]);

    useEffect(() => {
        if (isRunningRef.current) return;

        const runCycle = async () => {
            isRunningRef.current = true;
            try {
                const effectiveConfigs = buildMatrixRunnerConfigs(matrixScanners);
                if (effectiveConfigs.length === 0) return;

                for (const config of effectiveConfigs) {
                    const { symbol, interval, source, strategyId, timeframe } = config;
                    const normalizedSymbol = normalizeSymbol(symbol);
                    const pairKey = `${source}:${normalizedSymbol}:${interval}`;
                    const candles = candleData[pairKey];

                    if (!candles || candles.length < 5) continue;

                    const strategy = strategies.find((s) => s.id === strategyId && s.active);
                    if (!strategy) continue;
                    const symbolMatch = !strategy.symbol || normalizeSymbol(strategy.symbol) === normalizedSymbol;
                    const timeframeMatch = !strategy.timeframe || normalizeTF(strategy.timeframe) === normalizeTF(interval);
                    if (!symbolMatch || !timeframeMatch) continue;

                    const lastCandle = candles[candles.length - 1] as Candle;
                    const rawTime = lastCandle.time as unknown;
                    const lastTime = typeof rawTime === 'object' ? Number((rawTime as { timestamp?: number }).timestamp || 0) : Number(rawTime);

                    const processKey = `${strategy.id}:${symbol}:${interval}`;
                    if (Date.now() - (lastProcessedTimeRef.current[processKey] || 0) < 1000) continue;
                    lastProcessedTimeRef.current[processKey] = Date.now();

                    try {
                        const isNewBar = lastTime > (lastBarTimeRef.current[processKey] || 0);
                        if (isNewBar) lastBarTimeRef.current[processKey] = lastTime;

                        const store = useStrategyStore.getState();
                        const strategyPositions = store.virtualPositions.filter(
                            (p) => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed'
                        );

                        strategyPositions.forEach((position) => {
                            managePositionOnTick(strategy, position, symbol, candles, lastCandle, isNewBar, store, sendMessage);
                        });

                        const latestStore = useStrategyStore.getState();
                        const latestVirtualPositions = latestStore.virtualPositions;

                        if (!isNewBar) {
                            capturePostExitContexts(strategy, symbol, candles, latestVirtualPositions, latestStore.updateVirtualPosition);
                            continue;
                        }

                        const engineCtx: EngineContext = {
                            activePositions: [...positions, ...latestVirtualPositions],
                            currentPrice: lastCandle.close,
                            symbol,
                            lastSignalTime: strategy.lastSignalTime
                        };

                        const signal = RuleEngine.run(strategy, candles, engineCtx);
                        if (!signal) continue;

                        processStrategySignal(
                            strategy,
                            signal,
                            symbol,
                            timeframe || chartIntervalToDashboardTf(interval),
                            candles,
                            lastCandle,
                            latestVirtualPositions,
                            latestStore,
                            lastTime
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

        void runCycle();
    }, [candleData, tabs, strategies, positions, sendMessage, matrixScanners]);
}
