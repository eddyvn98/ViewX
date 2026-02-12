import { useEffect } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStrategyStore } from '../store/strategy-store';

interface StrategyMarkersProps {
    chart: IChartApi;
    mainSeries: ISeriesApi<"Candlestick">;
    symbol: string;
}

export const StrategyMarkers = ({ chart, mainSeries, symbol }: StrategyMarkersProps) => {
    const virtualPositions = useStrategyStore(state => state.virtualPositions);

    useEffect(() => {
        if (!chart || !mainSeries || !symbol) return;

        const activePositions = virtualPositions.filter(p => (p.status === 'open' || p.status === 'pending') && p.symbol === symbol);
        const lines: any[] = [];

        activePositions.forEach(pos => {
            const isPending = pos.status === 'pending';
            const baseColor = pos.type === 'BUY' ? '#26a69a' : '#ef5350';
            const pendingColor = '#ff9800'; // Orange for pending

            // Entry Line
            const entryLine = mainSeries.createPriceLine({
                price: pos.entryPrice,
                color: isPending ? pendingColor : baseColor,
                lineWidth: 2,
                lineStyle: isPending ? 2 : 1, // Dashed for pending
                axisLabelVisible: true,
                title: `${isPending ? 'PENDING' : 'STRAT'} ${pos.type}`,
            });
            lines.push(entryLine);

            // SL Line
            const slLine = mainSeries.createPriceLine({
                price: pos.sl,
                color: '#ff5252',
                lineWidth: 1,
                lineStyle: 3, // Dotted
                axisLabelVisible: true,
                title: `SL (${pos.status})`,
            });
            lines.push(slLine);

            // TP Line
            const tpLine = mainSeries.createPriceLine({
                price: pos.tp,
                color: '#2196f3',
                lineWidth: 1,
                lineStyle: 3, // Dotted
                axisLabelVisible: true,
                title: `TP (${pos.status})`,
            });
            lines.push(tpLine);
        });

        return () => {
            lines.forEach(line => mainSeries.removePriceLine(line));
        };
    }, [virtualPositions, symbol, mainSeries, chart]);

    return null;
};
