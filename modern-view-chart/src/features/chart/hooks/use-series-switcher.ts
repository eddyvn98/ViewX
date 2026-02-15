import { IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { DiamondSeries } from '../logic/diamond-series';

interface UseSeriesSwitcherProps {
    chartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.MutableRefObject<ISeriesApi<any> | null>;
    chartType: string;
}

export function useSeriesSwitcher({ chartRef, seriesRef, chartType }: UseSeriesSwitcherProps) {
    const handleSwitch = (isContextChange: boolean, lastChartType: string) => {
        if (!chartRef.current || !seriesRef.current) return;

        const isTypeChange = chartType !== lastChartType;
        if (!isTypeChange && !isContextChange) return;

        const isSmart = chartType === 'smart_candles';
        const currentIsDiamond = (seriesRef.current as any)?.seriesType?.() === 'Custom';

        if (isSmart && !currentIsDiamond) {
            console.log("[SeriesSwitcher] Switching to Diamond Series");
            chartRef.current.removeSeries(seriesRef.current);
            seriesRef.current = chartRef.current.addCustomSeries(new DiamondSeries(), {
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineStyle: 2,
            }) as any;
        } else if (!isSmart && currentIsDiamond) {
            console.log("[SeriesSwitcher] Switching back to Candlestick Series");
            chartRef.current.removeSeries(seriesRef.current);
            seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
                borderVisible: false,
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineStyle: 2,
            });
        }
    };

    return { handleSwitch };
}
