import { useEffect } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStrategyStore } from '../store/strategy-store';

interface StrategyMarkersProps {
    chart: IChartApi;
    mainSeries: ISeriesApi<"Candlestick">;
    symbol: string;
}

export const StrategyMarkers = ({ chart, mainSeries, symbol }: StrategyMarkersProps) => {
    const showHistoryMarkers = useStrategyStore(state => state.showHistoryMarkers);
    const virtualPositions = useStrategyStore(state => state.virtualPositions);

    useEffect(() => {
        if (!chart || !mainSeries || !symbol) return;

        // 1. Handle Active/Pending Lines (Price Lines)
        const activePositions = virtualPositions.filter(p =>
            (p.status === 'open' || p.status === 'pending') &&
            p.symbol === symbol &&
            p.strategyId !== ''
        );

        const lines: any[] = [];
        activePositions.forEach(pos => {
            const isPending = pos.status === 'pending';
            const baseColor = pos.type === 'BUY' ? '#26a69a' : '#ef5350';
            const pendingColor = '#ff9800';

            const entryLine = mainSeries.createPriceLine({
                price: pos.entryPrice,
                color: isPending ? pendingColor : baseColor,
                lineWidth: 2,
                lineStyle: isPending ? 2 : 1,
                axisLabelVisible: true,
                title: `${isPending ? 'PENDING' : 'STRAT'} ${pos.type}`,
            });
            lines.push(entryLine);

            const slLine = mainSeries.createPriceLine({
                price: pos.sl,
                color: '#ff5252',
                lineWidth: 1,
                lineStyle: 3,
                axisLabelVisible: true,
                title: `SL (${pos.status})`,
            });
            lines.push(slLine);

            const tpLine = mainSeries.createPriceLine({
                price: pos.tp,
                color: '#2196f3',
                lineWidth: 1,
                lineStyle: 3,
                axisLabelVisible: true,
                title: `TP (${pos.status})`,
            });
            lines.push(tpLine);
        });

        // 2. Handle Closed Positions (Icons/Markers)
        if (showHistoryMarkers) {
            const closedPositions = virtualPositions.filter(p =>
                p.status === 'closed' &&
                p.symbol === symbol
            );

            const markers: any[] = [];
            closedPositions.forEach(pos => {
                const entryTime = Math.floor(pos.timestamp / 1000);

                // Entry Marker
                markers.push({
                    time: entryTime,
                    position: pos.type === 'BUY' ? 'belowBar' : 'aboveBar',
                    color: pos.type === 'BUY' ? '#22c55e' : '#ef4444',
                    shape: pos.type === 'BUY' ? 'arrowUp' : 'arrowDown',
                    text: `${pos.type}`,
                });

                // Exit Marker
                if (pos.exitPrice) {
                    // Use recorded exit timestamp, or fallback to +1 candle if missing
                    const exitTime = pos.exitTimestamp
                        ? Math.floor(pos.exitTimestamp / 1000)
                        : entryTime + 60; // Fallback for old data

                    markers.push({
                        time: exitTime,
                        position: pos.type === 'BUY' ? 'aboveBar' : 'belowBar',
                        color: (pos.pnl || 0) >= 0 ? '#3b82f6' : '#71717a',
                        shape: 'circle',
                        text: `EXIT ($${pos.pnl?.toFixed(1)})`,
                    });
                }
            });

            // Sort markers by time as required by lightweight-charts
            const uniqueMarkers = markers.sort((a, b) => a.time - b.time);

            if ((mainSeries as any).setMarkers) {
                (mainSeries as any).setMarkers(uniqueMarkers);
            }
        } else {
            if ((mainSeries as any).setMarkers) {
                (mainSeries as any).setMarkers([]);
            }
        }

        return () => {
            lines.forEach(line => mainSeries.removePriceLine(line));
            if ((mainSeries as any).setMarkers) {
                (mainSeries as any).setMarkers([]);
            }
        };

    }, [virtualPositions, symbol, mainSeries, chart, showHistoryMarkers]);


    return null;
};
