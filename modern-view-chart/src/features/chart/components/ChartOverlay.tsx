import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useMarketStore, Candle } from '@/lib/store';
import { useChartIndicatorValues } from '../hooks/use-chart-indicator-values';

interface ChartOverlayProps {
    chartId: string;
    symbol?: string;
    interval?: string;
    source?: string;
    candles: Candle[];
    currentPrice?: number;
}

export function ChartOverlay({ chartId, symbol, interval, source, candles, currentPrice }: ChartOverlayProps) {
    const data = useChartOHLC(symbol, interval, source);
    useChartIndicatorValues(chartId, candles, data?.activeIndex ?? -1, currentPrice);

    if (!data) return null;

    return (
        <div className="absolute top-2 left-3 z-10 flex flex-col gap-1 pointer-events-none select-none">
            {/* Overlay actions can be added here in the future if needed */}
        </div>
    );
}
