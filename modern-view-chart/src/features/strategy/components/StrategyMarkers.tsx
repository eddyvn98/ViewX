import { useEffect, useRef, memo } from 'react';
import { IChartApi, ISeriesApi, createSeriesMarkers, ISeriesMarkersPluginApi, Time, SeriesMarker } from 'lightweight-charts';
import { useStrategyStore } from '../store/strategy-store';
import { normalizeTF } from '../utils/time-utils';

interface StrategyMarkersProps {
    chart: IChartApi;
    mainSeries: ISeriesApi<any>;
    symbol: string;
    interval?: string;
}

export const StrategyMarkers = memo(({ chart, mainSeries, symbol, interval }: StrategyMarkersProps) => {
    const showHistoryMarkers = useStrategyStore(state => state.showHistoryMarkers);
    const virtualPositions = useStrategyStore(state => state.virtualPositions);
    const strategies = useStrategyStore(state => state.strategies);

    const currentInterval = normalizeTF(interval);
    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

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
                p.symbol === symbol ||
                p.symbol.replace(/[.m]/g, '') === symbol.replace(/[.m]/g, '')
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
        closedPositions.forEach(pos => {
            const entryTime = Math.floor(pos.timestamp / 1000) as Time;

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
                const exitTime = (pos.exitTimestamp
                    ? Math.floor(pos.exitTimestamp / 1000)
                    : (Math.floor(pos.timestamp / 1000) + 60)) as Time;

                markers.push({
                    time: exitTime,
                    position: pos.type === 'BUY' ? 'aboveBar' : 'belowBar',
                    color: (pos.pnl || 0) >= 0 ? '#3b82f6' : '#71717a',
                    shape: 'circle',
                    text: '',
                });
            }
        });

        markers.sort((a, b) => (a.time as number) - (b.time as number));
        plugin.setMarkers(markers);

    }, [virtualPositions, symbol, showHistoryMarkers, mainSeries, strategies, currentInterval]);

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

        const lines: any[] = [];
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
                    axisLabelVisible: true,
                    title: `${isPending ? 'STP' : ''} ${pos.type === 'BUY' ? '↑' : '↓'}`,
                });
                lines.push(entryLine);

                if (pos.sl) {
                    const slLine = mainSeries.createPriceLine({
                        price: pos.sl,
                        color: '#ff5252',
                        lineWidth: 1,
                        lineStyle: 3,
                        axisLabelVisible: true,
                        title: `SL`,
                    });
                    lines.push(slLine);
                }

                if (pos.tp) {
                    const tpLine = mainSeries.createPriceLine({
                        price: pos.tp,
                        color: '#2196f3',
                        lineWidth: 1,
                        lineStyle: 3,
                        axisLabelVisible: true,
                        title: `TP`,
                    });
                    lines.push(tpLine);
                }
            } catch (err) {
                // Silently handle error to avoid crashing
            }
        });

        return () => {
            lines.forEach(line => {
                try {
                    mainSeries.removePriceLine(line);
                } catch (e) { }
            });
        };
    }, [virtualPositions, symbol, currentInterval, showHistoryMarkers, mainSeries, strategies]);

    // 4. Handle "Focus on Chart" requests
    useEffect(() => {
        if (!chart || !symbol) return;

        const handleFocus = (e: any) => {
            const { symbol: targetSymbol, timestamp, exitTimestamp } = e.detail;
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

        window.addEventListener('chart_focus_request' as any, handleFocus);
        return () => window.removeEventListener('chart_focus_request' as any, handleFocus);
    }, [chart, symbol]);

    return null;
});
