import { IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { debugLog } from '@/lib/debug';
import { DiamondSeries } from '../logic/diamond-series';

interface UseSeriesSwitcherProps {
    chartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
    chartType: string;
    candleUpColor: string;
    candleDownColor: string;
}

type SeriesWithType = ISeriesApi<'Candlestick'> & {
    seriesType?: () => unknown;
};

export function useSeriesSwitcher({ chartRef, seriesRef, chartType, candleUpColor, candleDownColor }: UseSeriesSwitcherProps) {
    const getSeriesTypeName = (series: ISeriesApi<'Candlestick'> | null): string => {
        const fn = (series as SeriesWithType | null)?.seriesType;
        if (typeof fn !== 'function') return '';
        return String(fn.call(series));
    };

    const handleSwitch = (isContextChange: boolean, lastChartType: string) => {
        const chart = chartRef.current;
        if (!chart || !seriesRef.current) return;

        const isTypeChange = chartType !== lastChartType;
        const currentIsDiamond = getSeriesTypeName(seriesRef.current) === 'Custom';
        const needsDiamond = chartType === 'smart_candles';
        const hasTypeMismatch = currentIsDiamond !== needsDiamond;

        if (!isTypeChange && !(isContextChange && hasTypeMismatch) && !hasTypeMismatch) return;

        const latestSeries = seriesRef.current;
        if (!latestSeries) return;
        const latestIsDiamond = getSeriesTypeName(latestSeries) === 'Custom';
        const latestMismatch = latestIsDiamond !== needsDiamond;

        if (!isTypeChange && !latestMismatch) return;

        debugLog(`[SeriesSwitcher] Switching to ${needsDiamond ? 'Diamond' : 'Candlestick'} Series`);
        try {
            chart.removeSeries(latestSeries);
        } catch {
            // Error ignored during chart remount
        }

        if (needsDiamond) {
            seriesRef.current = chart.addCustomSeries(new DiamondSeries(), {
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineStyle: 2,
            }) as unknown as ISeriesApi<'Candlestick'>;
        } else {
            seriesRef.current = chart.addSeries(CandlestickSeries, {
                upColor: candleUpColor,
                downColor: candleDownColor,
                borderVisible: false,
                wickUpColor: candleUpColor,
                wickDownColor: candleDownColor,
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineStyle: 2,
            });
        }
    };

    return { handleSwitch };
}
