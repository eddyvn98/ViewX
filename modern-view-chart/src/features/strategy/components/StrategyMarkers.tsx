import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, createSeriesMarkers, ISeriesMarkersPluginApi, Time, SeriesMarker } from 'lightweight-charts';
import { useStrategyStore } from '../store/strategy-store';

interface StrategyMarkersProps {
    chart: IChartApi;
    mainSeries: ISeriesApi<"Candlestick">;
    symbol: string;
    interval?: string;
}

export const StrategyMarkers = ({ chart, mainSeries, symbol, interval }: StrategyMarkersProps) => {
    const showHistoryMarkers = useStrategyStore(state => state.showHistoryMarkers);
    const virtualPositions = useStrategyStore(state => state.virtualPositions);
    const strategies = useStrategyStore(state => state.strategies);

    // Normalize timeframe strings for comparison (e.g., '1m' vs '1')
    const normalizeTF = (tf: string | undefined) => {
        if (!tf) return '';
        return tf.toLowerCase().replace('m', '');
    };

    const currentInterval = normalizeTF(interval);

    // Ref for the markers plugin instance (Lightweight Charts v5+)
    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

    // 1. Initialize & Cleanup Markers Plugin
    useEffect(() => {
        if (!mainSeries) return;

        // Create the plugin instance and attach to series
        // Note: We initialize with empty markers. Options can be passed as 3rd arg.
        const plugin = createSeriesMarkers(mainSeries, [], {
            autoScale: true
        });
        markersPluginRef.current = plugin;

        return () => {
            // Detach plugin on unmount or series change
            if (markersPluginRef.current) {
                markersPluginRef.current.detach();
                markersPluginRef.current = null;
            }
        };
    }, [mainSeries]);

    // 2. Update Markers Data
    useEffect(() => {
        const plugin = markersPluginRef.current;
        if (!plugin) return;

        if (!showHistoryMarkers) {
            plugin.setMarkers([]);
            return;
        }

        const closedPositions = virtualPositions.filter(p => {
            const isMatch = p.status === 'closed' && (p.symbol === symbol || !p.symbol);
            if (!isMatch) return false;

            // Timeframe filtering: Only show if strategy timeframe matches current chart interval
            if (currentInterval) {
                const strat = strategies.find(s => s.id === p.strategyId);
                const stratTF = normalizeTF(strat?.timeframe);
                // If strategy has a timeframe, it must match. If it doesn't, we show it everywhere.
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

        // Lightweight Charts requires sorted markers
        markers.sort((a, b) => (a.time as number) - (b.time as number));

        // Update the plugin
        plugin.setMarkers(markers);

        console.log(`[Markers] Updated ${markers.length} history markers for ${symbol}`);

    }, [virtualPositions, symbol, showHistoryMarkers, mainSeries]); // Re-run when data changes. pluginRef.current is stable usually but depends on mainSeries.

    // 3. Handle Active/Pending Lines (Price Lines)
    useEffect(() => {
        if (!mainSeries || !symbol) return;

        const activePositions = virtualPositions.filter(p => {
            const isMatch = (p.status === 'open' || p.status === 'pending') &&
                (p.symbol === symbol || !p.symbol) &&
                p.strategyId !== '';

            if (!isMatch) return false;

            // Timeframe filtering for active lines
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
                    lineStyle: isPending ? 2 : 1, // Dashed for pending
                    axisLabelVisible: true,
                    title: `${isPending ? 'STP' : ''} ${pos.type === 'BUY' ? '↑' : '↓'}`,
                });
                lines.push(entryLine);

                if (pos.sl) {
                    const slLine = mainSeries.createPriceLine({
                        price: pos.sl,
                        color: '#ff5252',
                        lineWidth: 1,
                        lineStyle: 3, // Dotted
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
                        lineStyle: 3, // Dotted
                        axisLabelVisible: true,
                        title: `TP`,
                    });
                    lines.push(tpLine);
                }
            } catch (err) {
                console.error("[Markers] Error creating price line:", err);
            }
        });

        return () => {
            lines.forEach(line => {
                try {
                    mainSeries.removePriceLine(line);
                } catch (e) { /* ignore cleanup errors */ }
            });
        };

        // Re-run when data, symbol, or timeframe changes
    }, [virtualPositions, symbol, currentInterval, showHistoryMarkers, mainSeries, strategies]);

    // 4. Handle "Focus on Chart" requests from Dashboard
    useEffect(() => {
        if (!chart || !symbol) return;

        const handleFocus = (e: any) => {
            const { symbol: targetSymbol, timestamp, exitTimestamp } = e.detail;

            // Symbol normalization for flexible matching
            const normTarget = targetSymbol?.replace('USDM', '').replace('USDT', '');
            const normCurrent = symbol?.replace('USDM', '').replace('USDT', '');

            if (normTarget === normCurrent) {
                const entryVal = Math.floor(timestamp / 1000);
                const exitVal = exitTimestamp ? Math.floor(exitTimestamp / 1000) : entryVal + 300;

                // Calculate reasonable padding based on trade duration
                const duration = exitVal - entryVal;
                const padding = Math.max(duration * 2, 3600); // At least 1 hour padding or 2x duration

                console.log(`[Markers] Focusing chart on ${symbol} @ ${entryVal}`);

                chart.timeScale().setVisibleRange({
                    from: (entryVal - padding) as Time,
                    to: (exitVal + padding) as Time
                });

                // Trigger a slight highlight or visual feedback if possible
                // For now, center the view is enough
            }
        };

        window.addEventListener('chart_focus_request' as any, handleFocus);
        return () => window.removeEventListener('chart_focus_request' as any, handleFocus);
    }, [chart, symbol]);

    return null;
};
