import { useEffect, useRef } from 'react';
import { IChartApi } from 'lightweight-charts';
import { Candle, useMarketStore, IndicatorConfig } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { EMAIndicator } from '../indicators/EMAIndicator';
import { HMAIndicator } from '../indicators/HMAIndicator';
import { RSIIndicator } from '../indicators/RSIIndicator';
import { SignalIndicator } from '../indicators/SignalIndicator';

const EMPTY_INDICATORS: any[] = [];

/* ❌ FIX 1: KHÔNG offset time lần nữa (đã offset ở data layer) */
const formatCandles = (candles: Candle[]) =>
    candles.map(c => ({
        ...c,
        time: c.time as any,
    }));

export function useChartIndicators(
    chartId: string,
    priceChartRef: React.RefObject<IChartApi | null>,
    subchartChartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<any>,
    candles: Candle[],
    symbol: string | undefined,
    timezone: string | undefined,
    syncRange: () => void
) {
    const indicators = useMarketStore(
        useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS)
    );
    const addIndicators = useMarketStore(state => state.addIndicators);

    const instancesRef = useRef<Record<string, any>>({});
    const defaultsAppliedRef = useRef(false);

    /* ===== DEFAULT INDICATORS ===== */
    useEffect(() => {
        if (!symbol || defaultsAppliedRef.current || indicators.length > 0) return;

        addIndicators(chartId, [
            { type: 'EMA', params: { period: 25 }, color: '#9c27b0', visible: true, lineWidth: 1, pane: 'main' },
            { type: 'HMA', params: { period: 25 }, color: '#00bcd4', visible: true, lineWidth: 2, pane: 'main' },
            { type: 'RSI', params: { period: 14 }, color: '#f06292', visible: true, lineWidth: 2, pane: 'subchart' },
            { type: 'Signals', params: { upperLimit: 60, lowerLimit: 40 }, color: '#22c55e', visible: true, lineWidth: 1, pane: 'main' },
        ]);

        defaultsAppliedRef.current = true;
    }, [chartId, symbol, indicators.length, addIndicators]);

    /* ===== UPDATE INDICATORS ===== */
    useEffect(() => {
        if (
            !priceChartRef.current ||
            !subchartChartRef.current ||
            !seriesRef.current ||
            !seriesRef.current ||
            !symbol
        )
            return;

        /* ❌ FIX 2: KHÔNG cộng offset time lần 2 */
        const formattedCandles = formatCandles(candles);

        /* Cleanup removed */
        const currentIds = new Set(indicators.map(i => i.id));
        Object.keys(instancesRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                instancesRef.current[id].destroy();
                delete instancesRef.current[id];
            }
        });

        /* Create / Update */
        indicators.forEach(config => {
            let instance = instancesRef.current[config.id];

            if (!instance) {
                const isSubchart = config.pane === 'subchart';
                const targetChart = isSubchart
                    ? subchartChartRef.current!
                    : priceChartRef.current!;

                switch (config.type) {
                    case 'EMA':
                        instance = new EMAIndicator(targetChart, config);
                        break;
                    case 'HMA':
                        instance = new HMAIndicator(targetChart, config);
                        break;
                    case 'RSI':
                        instance = new RSIIndicator(targetChart, config);
                        break;
                    case 'Signals':
                        instance = new SignalIndicator(seriesRef.current, config);
                        break;
                }

                if (instance) {
                    instancesRef.current[config.id] = instance;
                }
            }

            if (instance) {
                instance.update(formattedCandles, config);
            }
        });

        /* ❌ FIX 3: BẮT BUỘC sync range sau khi Subchart setData */
        const hasSubchartIndicator = indicators.some(i => i.pane === 'subchart');

        if (hasSubchartIndicator) {
            requestAnimationFrame(() => {
                setTimeout(syncRange, 0);
            });
        }



    }, [
        chartId,
        indicators,
        candles,
        symbol,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        syncRange,
    ]);

    /* ===== CLEANUP ===== */
    useEffect(() => {
        return () => {
            Object.values(instancesRef.current).forEach(inst => {
                try {
                    inst?.destroy?.();
                } catch { }
            });
            instancesRef.current = {};
        };
    }, []);
}
