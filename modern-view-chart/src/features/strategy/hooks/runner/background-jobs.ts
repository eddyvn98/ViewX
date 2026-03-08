import { toast } from 'sonner';
import { AiAnalyzer, AnalysisType } from '../../logic/AiAnalyzer';
import { ContextCollector } from '../../logic/ContextCollector';
import { StatsService } from '../../logic/StatsService';
import { TradeLogger } from '../../logic/TradeLogger';
import { soundService } from '../../logic/SoundService';
import { useStrategyStore } from '../../store/strategy-store';
import type { Strategy, VirtualPosition } from '../../types';
import type { StrategySignal } from '../../types';
import type { MarketMetrics } from '../../logic/AiManager';
import type { Candle } from '@/lib/store/types';

interface AiMetrics {
    spread: number;
    volatility: number;
    trendStrength: number;
    rsi: number;
    session: string;
}

export function capturePostExitContexts(
    strategy: Strategy,
    symbol: string,
    candles: Candle[],
    positions: VirtualPosition[],
    updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => void
) {
    const expiredClosed = positions.filter((p) =>
        p.strategyId === strategy.id &&
        p.symbol === symbol &&
        p.status === 'closed' &&
        p.exitTimestamp &&
        (Date.now() - p.exitTimestamp > 60000) &&
        (Date.now() - p.exitTimestamp < 300000) &&
        !p.metadata?.post_exit
    );

    expiredClosed.forEach((p) => {
        const postExit = ContextCollector.capturePostExitContext(strategy, candles);
        updateVirtualPosition(p.id, { metadata: { ...(p.metadata || { indicators_snapshot: {}, session: 'Asian' }), post_exit: postExit } });
    });
}

export function runAiAuditAndTradeLogging(
    strategy: Strategy,
    signal: StrategySignal,
    candles: Candle[],
    symbol: string
) {
    void (async () => {
        try {
            const stats = await StatsService.compute(strategy.id);
            const metrics = ContextCollector.captureEntryContext(strategy, candles, symbol);

            const aiMetrics: AiMetrics = {
                spread: metrics.spread_at_entry || 0,
                volatility: metrics.volatility_atr || 0,
                trendStrength: metrics.mtf?.h1_trend === 'UP' ? 30 : 10,
                rsi: metrics.indicators_snapshot['RSI[14]'] || 50,
                session: metrics.session
            };

            let aiResult = null;
            if (strategy.aiGuard) {
                toast.info(`AI is auditing ${strategy.name} signal...`, { icon: '🧠' });
                soundService.playAIThinking();

                const ai = await AiAnalyzer.analyzeSignal(strategy, signal, aiMetrics, stats, AnalysisType.PRE_TRADE);
                aiResult = ai;

                const store = useStrategyStore.getState();
                const latestSignals = store.signals;
                const sigIndex = latestSignals.findIndex((s) => s.symbol === symbol && s.timestamp === signal.timestamp);
                if (sigIndex !== -1) {
                    const updatedSig = { ...latestSignals[sigIndex], aiAnalysis: ai };
                    store.updateSignal(sigIndex, updatedSig);
                }

                if (ai.confidence) {
                    const latestPos = store.virtualPositions.find(
                        (p) =>
                            p.strategyId === strategy.id &&
                            p.symbol === symbol &&
                            p.status !== 'closed' &&
                            (!signal.matrixScopeKey || p.matrixScopeKey === signal.matrixScopeKey)
                    );
                    if (latestPos) store.updateVirtualPosition(latestPos.id, { confidence: ai.confidence });
                }
            }

            await TradeLogger.logEntry({ ...signal, aiAnalysis: aiResult }, aiMetrics as MarketMetrics);
        } catch (err) {
            console.error('[Runner] Background tasks failed:', err);
            toast.error('AI Audit failed for live signal');
        }
    })();
}
