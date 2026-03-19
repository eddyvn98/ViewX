import React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, History as HistoryIcon } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { calculatePnL } from '@/lib/utils/pnl';
import { toast } from 'sonner';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { VirtualBalanceCard } from '@/features/strategy/components/VirtualBalanceCard';
import { StrategySignalScanners } from '@/features/strategy/components/StrategySignalScanners';
import { ActivePositionItem } from '@/features/strategy/components/signals-view/ActivePositionItem';
import { SignalHistoryList } from '@/features/strategy/components/signals-view/SignalHistoryList';
import { SignalRangeTabs } from '@/features/strategy/components/signals-view/SignalRangeTabs';
import type { SignalRange } from '@/features/strategy/components/signals-view/types';
import { useSignalHistoryFilters } from '@/features/strategy/hooks/useSignalHistoryFilters';
import type { StrategySignal, TradeContext, VirtualPosition } from '@/features/strategy/types';
import { AiAnalyzer, AnalysisType } from '../logic/AiAnalyzer';
import { ContextCollector } from '../logic/ContextCollector';
import { StatsService } from '../logic/StatsService';

interface SignalsViewProps {
    showVirtualBalanceCard?: boolean;
    showMatrix?: boolean;
}

export function SignalsView({ showVirtualBalanceCard = true, showMatrix = true }: SignalsViewProps = {}) {
    const t = useTranslations('Signals');
    const {
        signals,
        strategies,
        virtualPositions,
        matrixScanners,
        closeVirtualPosition,
        cancelVirtualPosition,
        updateSignal,
        addSignal,
    } = useStrategyStore();

    const [analyzingIndex, setAnalyzingIndex] = React.useState<number | null>(null);
    const selectedRange = useMarketStore((state) => state.signalHistoryRange) as SignalRange;
    const setSelectedRange = useMarketStore((state) => state.setSignalHistoryRange);

    const aiGuardStrategyIds = React.useMemo(
        () => new Set(strategies.filter((strategy) => strategy.aiGuard).map((strategy) => strategy.id)),
        [strategies]
    );

    const { scannerStrategyIds, visibleSignals, filteredSignals } = useSignalHistoryFilters({
        signals,
        matrixScanners,
        selectedRange,
    });

    const tickers = useMarketStore((state) => state.tickers);
    const symbolInfo = useMarketStore((state) => state.symbolInfo);

    const activePositions = React.useMemo(
        () =>
            virtualPositions.filter(
                (position) =>
                    (position.status === 'open' || position.status === 'pending') &&
                    (scannerStrategyIds.size === 0 || scannerStrategyIds.has(position.strategyId))
            ),
        [virtualPositions, scannerStrategyIds]
    );

    const handleManualAnalyze = async (signalIndex: number, signal: StrategySignal) => {
        setAnalyzingIndex(signalIndex);
        try {
            const strategy = strategies.find((s) => s.id === signal.strategyId);
            if (!strategy) throw new Error('Strategy not found');

            const allCandleData = useMarketStore.getState().candleData;
            const timeframe = strategy.timeframe || '1m';
            const normalizedSymbol = signal.symbol.toLowerCase().replace('m', '');

            const dataKey = Object.keys(allCandleData).find((key) => {
                const parts = key.toLowerCase().split(':');
                if (parts.length < 2) return false;
                const symbol = parts[1];
                const tf = parts[2] || '';
                return (
                    (symbol === normalizedSymbol || symbol.includes(normalizedSymbol)) &&
                    tf.replace('m', '') === timeframe.toLowerCase().replace('m', '')
                );
            });

            const candles = dataKey ? allCandleData[dataKey] : [];
            const stats = await StatsService.compute(signal.strategyId);
            const metrics = ContextCollector.captureEntryContext(strategy, candles, signal.symbol);

            const aiMetrics = {
                spread: metrics.spread_at_entry || 0,
                volatility: metrics.volatility_atr || 0,
                trendStrength: metrics.mtf?.h1_trend === 'UP' ? 30 : 10,
                rsi: metrics.indicators_snapshot['RSI[14]'] || 50,
                session: metrics.session,
            };

            const ai = await AiAnalyzer.analyzeSignal(
                strategy,
                signal as unknown as Record<string, unknown>,
                aiMetrics as unknown as Record<string, unknown>,
                stats,
                AnalysisType.PRE_TRADE
            );
            updateSignal(signalIndex, { ...signal, aiAnalysis: ai });
            toast.success(t('aiAuditComplete', { confidence: ai.confidence.toFixed(0) }));
        } catch (error) {
            console.error('[Signals] AI Analysis failed:', error);
            toast.error('AI Analysis failed');
        } finally {
            setAnalyzingIndex(null);
        }
    };

    const handleCloseOrCancel = (position: VirtualPosition, currentPrice: number) => {
        if (position.status === 'open') {
            closeVirtualPosition(position.strategyId, position.symbol, currentPrice);
            addSignal({
                type: 'EXIT',
                symbol: position.symbol,
                strategyId: position.strategyId,
                timestamp: Date.now(),
                price: currentPrice,
                risk: { trailing: false, lotSize: position.lotSize, sl: position.sl, tp: position.tp },
                direction: position.type,
                context: { exit_reason: 'MANUAL', session: 'Close' } as TradeContext,
                source: position.source,
                matrixScopeKey: position.matrixScopeKey,
            });
            return;
        }
        cancelVirtualPosition(position.strategyId, position.symbol);
        addSignal({
            type: 'CANCEL',
            symbol: position.symbol,
            strategyId: position.strategyId,
            timestamp: Date.now(),
            price: currentPrice,
            risk: { trailing: false, lotSize: position.lotSize, sl: position.sl, tp: position.tp },
            direction: position.type,
            context: { exit_reason: 'MANUAL', session: 'Close' } as TradeContext,
            source: position.source,
            matrixScopeKey: position.matrixScopeKey,
        });
    };

    return (
        <div className="flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-500 w-full pb-6 px-3">
            {showVirtualBalanceCard && <VirtualBalanceCard />}
            {showMatrix && (
                <div id="signal-monitor-matrix" data-testid="signal-monitor-matrix">
                    <StrategySignalScanners />
                </div>
            )}

            {activePositions.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
                            <Activity size={14} className="text-primary" /> {t('activeTrade')} ({activePositions.length})
                        </span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/10 to-transparent ml-4 opacity-50" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {activePositions.map((position) => {
                            const currentPrice = tickers[position.symbol]?.price || position.entryPrice;
                            const side = position.type === 'BUY' ? 'buy' : 'sell';
                            const pnl =
                                position.status === 'open'
                                    ? calculatePnL({
                                        type: side,
                                        openPrice: position.entryPrice,
                                        currentPrice,
                                        volume: position.lotSize,
                                        symbol: position.symbol,
                                        symbolInfo: symbolInfo[position.symbol],
                                    })
                                    : 0;

                            return (
                                <ActivePositionItem
                                    key={position.id}
                                    position={position}
                                    currentPrice={currentPrice}
                                    pnl={pnl}
                                    aiGuardEnabled={aiGuardStrategyIds.has(position.strategyId)}
                                    buyLabel={t('matrix.buy')}
                                    sellLabel={t('matrix.sell')}
                                    onCloseOrCancel={handleCloseOrCancel}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2">
                        <HistoryIcon size={12} /> {t('recentSignals')}
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    {visibleSignals.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center opacity-5 text-center gap-2">
                            <Activity size={24} />
                            <span className="text-[11px] uppercase font-black tracking-widest">{t('scanning')}</span>
                        </div>
                    ) : (
                        <>
                            <SignalRangeTabs
                                selectedRange={selectedRange}
                                onSelectRange={setSelectedRange}
                                labels={{
                                    day: t('rangeDay'),
                                    week: t('rangeWeek'),
                                    month: t('rangeMonth'),
                                }}
                            />

                            <div className="rounded-xl border border-border/40 dark:border-white/5 bg-secondary/20 dark:bg-white/[0.01] p-2">
                                <div className="flex items-center justify-end mb-2 px-0.5">
                                    <span className="text-[11px] font-bold text-muted-foreground/50">{filteredSignals.length}/8</span>
                                </div>
                                <SignalHistoryList
                                    filteredSignals={filteredSignals}
                                    virtualPositions={virtualPositions}
                                    analyzingIndex={analyzingIndex}
                                    aiGuardStrategyIds={aiGuardStrategyIds}
                                    noRecentSignalsLabel={t('noRecentSignals')}
                                    buyLabel={t('matrix.buy')}
                                    sellLabel={t('matrix.sell')}
                                    exitLabel={t('exit')}
                                    onManualAnalyze={handleManualAnalyze}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
