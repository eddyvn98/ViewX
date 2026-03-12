import { IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { debugLog } from '@/lib/debug';
import { DiamondSeries } from '../logic/diamond-series';

interface UseSeriesSwitcherProps {
    chartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.MutableRefObject<ISeriesApi<any> | null>;
    chartType: string;
}

export function useSeriesSwitcher({ chartRef, seriesRef, chartType }: UseSeriesSwitcherProps) {
    const handleSwitch = (isContextChange: boolean, lastChartType: string) => {
        const chart = chartRef.current;
        if (!chart || !seriesRef.current) return;

        const isTypeChange = chartType !== lastChartType;
        const currentIsDiamond = (seriesRef.current as any)?.seriesType?.() === 'Custom';
        const needsDiamond = chartType === 'smart_candles';
        const hasTypeMismatch = currentIsDiamond !== needsDiamond;

        if (!isTypeChange && !(isContextChange && hasTypeMismatch) && !hasTypeMismatch) return;

        const latestSeries = seriesRef.current;
        if (!latestSeries) return;
        const latestIsDiamond = (latestSeries as any)?.seriesType?.() === 'Custom';
        const latestMismatch = latestIsDiamond !== needsDiamond;

        if (!isTypeChange && !latestMismatch) return;

        debugLog(`[SeriesSwitcher] Switching to ${needsDiamond ? 'Diamond' : 'Candlestick'} Series`);
        try {
            chart.removeSeries(latestSeries as any);
        } catch {
            // Error ignored during chart remount
        }

        if (needsDiamond) {
            seriesRef.current = chart.addCustomSeries(new DiamondSeries(), {
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineStyle: 2,
            });
        } else {
            seriesRef.current = chart.addSeries(CandlestickSeries, {
                borderVisible: false,
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineStyle: 2,
            });
        }
    };

    return { handleSwitch };
}
