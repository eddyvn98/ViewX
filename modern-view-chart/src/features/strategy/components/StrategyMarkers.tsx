import { useEffect, useRef, memo } from 'react';
import { IChartApi, ISeriesApi, createSeriesMarkers, ISeriesMarkersPluginApi, Time, SeriesMarker, IPriceLine } from 'lightweight-charts';
import { useStrategyStore } from '../store/strategy-store';
import { normalizeTF } from '../utils/time-utils';
import { isSameSymbol } from '@/lib/utils/symbol';
import { useMarketStore } from '@/lib/store';

interface StrategyMarkersProps {
    chart: IChartApi;
    mainSeries: ISeriesApi<'Candlestick'>;
    symbol: string;
    interval?: string;
}

interface ChartFocusDetail {
    symbol?: string;
    timestamp: number;
    exitTimestamp?: number;
}

function StrategyMarkersView({ chart, mainSeries, symbol, interval }: StrategyMarkersProps) {
    const showHistoryMarkers = useStrategyStore(state => state.showHistoryMarkers);
    const virtualPositions = useStrategyStore(state => state.virtualPositions);
    const strategies = useStrategyStore(state => state.strategies);
    const signals = useStrategyStore(state => state.signals);
    const terminalPositions = useMarketStore(state => state.positions);
    const terminalOrders = useMarketStore(state => state.orders);

    const currentInterval = normalizeTF(interval);
    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

    const toEpochSec = (value: unknown): number | null => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n > 100000000000 ? Math.floor(n / 1000) : Math.floor(n);
    };

    const intervalToSec = (tf: string): number | null => {
        if (!tf) return null;
        const m = tf.match(/^(\d+)([mhd])$/i);
        if (!m) return null;
        const value = Number(m[1]);
        const unit = m[2].toLowerCase();
        if (!Number.isFinite(value) || value <= 0) return null;
        if (unit === 'm') return value * 60;
        if (unit === 'h') return value * 3600;
        if (unit === 'd') return value * 86400;
        return null;
    };

    const snapToInterval = (timestampSec: number, stepSec: number | null): number => {
        if (!stepSec || stepSec <= 1) return timestampSec;
        return Math.floor(timestampSec / stepSec) * stepSec;
    };

    // 1. Initialize & Cleanup Markers Plugin
    useEffect(() => {
        if (!mainSeries) return;

        const plugin = createSeriesMarkers(mainSeries, [], {
            autoScale: true
        });
        markersPluginRef.current = plugin;

        return () => {
            if (markersPluginRef.current) {
                markersPluginRef.current.detach();
                markersPluginRef.current = null;
            }
        };
    }, [mainSeries]);

    // 2. Update Markers Data
    useEffect(() => {
        const plugin = markersPluginRef.current;
        if (!plugin || !mainSeries) return;

        if (!showHistoryMarkers) {
            plugin.setMarkers([]);
            return;
        }

        const closedPositions = virtualPositions.filter(p => {
            const isMatch = p.status === 'closed' && (
                !p.symbol ||
                isSameSymbol(p.symbol, symbol)
            );

            if (!isMatch) return false;

            if (currentInterval) {
                const strat = strategies.find(s => s.id === p.strategyId);
                const stratTF = normalizeTF(strat?.timeframe);
                if (stratTF && stratTF !== currentInterval) return false;
            }
            return true;
        });

        const markers: SeriesMarker<Time>[] = [];
        const markerStepSec = intervalToSec(currentInterval);
        const markerDedupe = new Set<string>();

        const pushEntryMarker = (
            markerKey: string,
            timestampSec: number | null,
            isBuy: boolean,
            color: string
        ) => {
            if (!timestampSec) return;
            const markerTime = snapToInterval(timestampSec, markerStepSec);
            const dedupeKey = `${markerKey}-${markerTime}`;
            if (markerDedupe.has(dedupeKey)) return;
            markerDedupe.add(dedupeKey);

            markers.push({
                time: markerTime as Time,
                position: isBuy ? 'belowBar' : 'aboveBar',
                color,
                shape: isBuy ? 'arrowUp' : 'arrowDown',
                text: '',
            });
        };

        virtualPositions.forEach((pos) => {
            if (!isSameSymbol(pos.symbol, symbol)) return;
            if (!(pos.status === 'open' || pos.status === 'pending')) return;

            if (currentInterval) {
                const strat = strategies.find((s) => s.id === pos.strategyId);
                const stratTF = normalizeTF(strat?.timeframe);
                if (stratTF && stratTF !== currentInterval) return;
            }

            const isBuy = pos.type === 'BUY';
            const isPending = pos.status === 'pending';
            const color = isPending
                ? (isBuy ? '#f59e0b' : '#f97316')
                : (isBuy ? '#22c55e' : '#ef4444');

            pushEntryMarker(
                `web-${pos.id}-entry`,
                toEpochSec(pos.entry_time) ?? toEpochSec(pos.timestamp),
                isBuy,
                color
            );
        });

        terminalPositions.forEach((pos) => {
            if (!isSameSymbol(pos.symbol, symbol)) return;
            if (Number(pos.magic || 0) <= 0) return;

            const isBuy = String(pos.type).toLowerCase().includes('buy');
            const color = isBuy ? '#3b82f6' : '#ec4899';

            pushEntryMarker(
                `ext-pos-${pos.ticket}-entry`,
                toEpochSec(pos.entry_time) ?? toEpochSec(pos.time),
                isBuy,
                color
            );
        });

        terminalOrders.forEach((ord) => {
            if (!isSameSymbol(ord.symbol, symbol)) return;
            if (Number(ord.magic || 0) <= 0) return;

            const isBuy = String(ord.type).toLowerCase().includes('buy');
            const color = isBuy ? '#fbbf24' : '#fb7185';

            pushEntryMarker(
                `ext-ord-${ord.ticket}-entry`,
                toEpochSec(ord.entry_time) ?? toEpochSec(ord.time),
                isBuy,
                color
            );
        });

        closedPositions.forEach(pos => {
            const entryTimeRaw = toEpochSec(pos.entry_time) ?? toEpochSec(pos.timestamp);
            if (!entryTimeRaw) return;
            const entryTime = snapToInterval(entryTimeRaw, markerStepSec) as Time;

            // Entry Marker
            markers.push({
                time: entryTime,
                position: pos.type === 'BUY' ? 'belowBar' : 'aboveBar',
                color: pos.type === 'BUY' ? '#22c55e' : '#ef4444',
                shape: pos.type === 'BUY' ? 'arrowUp' : 'arrowDown',
                text: '',
            });

            // Exit Marker
            if (pos.exitPrice) {
                const exitTimeRaw = toEpochSec(pos.exitTimestamp) ?? (entryTimeRaw + 60);
                const exitTime = snapToInterval(exitTimeRaw, markerStepSec) as Time;

                markers.push({
                    time: exitTime,
                    position: pos.type === 'BUY' ? 'aboveBar' : 'belowBar',
                    color: (pos.pnl || 0) >= 0 ? '#3b82f6' : '#71717a',
                    shape: 'circle',
                    text: '',
                });
            }
        });

        signals
            .filter((sig) => isSameSymbol(sig.symbol, symbol))
            .forEach((sig) => {
                if (currentInterval) {
                    const strat = strategies.find((s) => s.id === sig.strategyId);
                    const stratTF = normalizeTF(strat?.timeframe);
                    if (stratTF && stratTF !== currentInterval) return;
                }

                const rawTime = toEpochSec(sig.timestamp);
                if (!rawTime) return;
                const markerTime = snapToInterval(rawTime, markerStepSec);

                const sideKey = `${markerTime}-${sig.type}`;
                if (markerDedupe.has(sideKey)) return;
                markerDedupe.add(sideKey);

                const markerMap: Record<string, { position: 'aboveBar' | 'belowBar'; color: string }> = {
                    BUY: { position: 'belowBar', color: '#22c55e' },
                    SELL: { position: 'aboveBar', color: '#ef4444' },
                    EXIT: { position: 'aboveBar', color: '#f59e0b' },
                    CANCEL: { position: 'belowBar', color: '#71717a' },
                };

                const visual = markerMap[sig.type];
                if (!visual) return;

                markers.push({
                    time: markerTime as Time,
                    position: visual.position,
                    color: visual.color,
                    shape: 'circle',
                    size: 1,
                    text: '',
                });
            });

        markers.sort((a, b) => (a.time as number) - (b.time as number));
        plugin.setMarkers(markers);

    }, [virtualPositions, terminalPositions, terminalOrders, signals, symbol, showHistoryMarkers, mainSeries, strategies, currentInterval]);

    // 3. Handle Active/Pending Lines (Price Lines)
    useEffect(() => {
        if (!mainSeries || !symbol) return;

        const activePositions = virtualPositions.filter(p => {
            const isMatch = (p.status === 'open' || p.status === 'pending') &&
                (p.symbol === symbol || !p.symbol) &&
                p.strategyId !== '';

            if (!isMatch) return false;

            if (currentInterval) {
                const strat = strategies.find(s => s.id === p.strategyId);
                const stratTF = normalizeTF(strat?.timeframe);
                if (stratTF && stratTF !== currentInterval) return false;
            }
            return true;
        });

        const lines: IPriceLine[] = [];
        activePositions.forEach(pos => {
            const isPending = pos.status === 'pending';
            const baseColor = pos.type === 'BUY' ? '#26a69a' : '#ef5350';
            const pendingColor = '#ff9800';

            try {
                const entryLine = mainSeries.createPriceLine({
                    price: pos.entryPrice,
                    color: isPending ? pendingColor : baseColor,
                    lineWidth: 2,
                    lineStyle: isPending ? 2 : 1,
                    axisLabelVisible: false,
                    title: '',
                });
                lines.push(entryLine);

                if (pos.sl) {
                    const slLine = mainSeries.createPriceLine({
                        price: pos.sl,
                        color: '#ff5252',
                        lineWidth: 1,
                        lineStyle: 3,
                        axisLabelVisible: false,
                        title: '',
                    });
                    lines.push(slLine);
                }

                if (pos.tp) {
                    const tpLine = mainSeries.createPriceLine({
                        price: pos.tp,
                        color: '#2196f3',
                        lineWidth: 1,
                        lineStyle: 3,
                        axisLabelVisible: false,
                        title: '',
                    });
                    lines.push(tpLine);
                }
            } catch {
                // Silently handle error to avoid crashing
            }
        });

        return () => {
            lines.forEach(line => {
                try {
                    mainSeries.removePriceLine(line);
                } catch { }
            });
        };
    }, [virtualPositions, symbol, currentInterval, showHistoryMarkers, mainSeries, strategies]);

    // 4. Handle "Focus on Chart" requests
    useEffect(() => {
        if (!chart || !symbol) return;

        const handleFocus = (e: Event) => {
            const customEvent = e as CustomEvent<ChartFocusDetail>;
            if (!customEvent.detail) return;
            const { symbol: targetSymbol, timestamp, exitTimestamp } = customEvent.detail;
            if (!Number.isFinite(timestamp)) return;
            const normTarget = targetSymbol?.replace('USDM', '').replace('USDT', '');
            const normCurrent = symbol?.replace('USDM', '').replace('USDT', '');

            if (normTarget === normCurrent) {
                const entryVal = Math.floor(timestamp / 1000);
                const exitVal = exitTimestamp ? Math.floor(exitTimestamp / 1000) : entryVal + 300;
                const duration = exitVal - entryVal;
                const padding = Math.max(duration * 2, 3600);

                chart.timeScale().setVisibleRange({
                    from: (entryVal - padding) as Time,
                    to: (exitVal + padding) as Time
                });
            }
        };

        window.addEventListener('chart_focus_request', handleFocus);
        return () => window.removeEventListener('chart_focus_request', handleFocus);
    }, [chart, symbol]);

    return null;
}

export const StrategyMarkers = memo(StrategyMarkersView);
StrategyMarkers.displayName = 'StrategyMarkers';
