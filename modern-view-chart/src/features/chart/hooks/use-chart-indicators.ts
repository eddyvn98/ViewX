import { useEffect, useRef } from 'react';
import { IChartApi } from 'lightweight-charts';
import { Candle, useMarketStore, IndicatorConfig } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { EMAIndicator } from '../indicators/EMAIndicator';
import { HMAIndicator } from '../indicators/HMAIndicator';
import { RSIIndicator } from '../indicators/RSIIndicator';
import { SignalIndicator } from '../indicators/SignalIndicator';

const EMPTY_INDICATORS: any[] = [];

export function useChartIndicators(
    chartId: string,
    chartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<any>,
    candles: Candle[],
    symbol: string | undefined,
    indicators: IndicatorConfig[] = EMPTY_INDICATORS
) {
    const addIndicators = useMarketStore(state => state.addIndicators);

    // Map of indicator ID to instance
    const instancesRef = useRef<Record<string, any>>({});
    const defaultsAppliedRef = useRef(false);

    // Initial default indicators if empty
    useEffect(() => {
        if (!symbol || defaultsAppliedRef.current || indicators.length > 0) return;

        addIndicators(chartId, [
            {
                type: 'EMA', params: { period: 25 }, color: '#9c27b0',
                visible: true, lineWidth: 1, pane: 'main'
            },
            {
                type: 'HMA', params: { period: 25 }, color: '#00bcd4',
                visible: true, lineWidth: 2, pane: 'main'
            },
            {
                type: 'RSI', params: { period: 14 }, color: '#fbbf24',
                visible: true, lineWidth: 2, pane: 'rsi'
            },
            {
                type: 'Signals', // Changed from 'HA' more descriptive
                params: { upperLimit: 60, lowerLimit: 40 }, color: '#22c55e',
                visible: true, lineWidth: 1, pane: 'main'
            }
        ]);

        defaultsAppliedRef.current = true;
    }, [chartId, symbol, indicators.length, addIndicators]);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !symbol || candles.length < 2) return;
        const chart = chartRef.current;
        const mainSeries = seriesRef.current;

        // Cleanup removed indicators
        const currentIds = new Set(indicators.map(i => i.id));
        Object.keys(instancesRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                instancesRef.current[id].destroy();
                delete instancesRef.current[id];
            }
        });

        // Update or Create indicators
        indicators.forEach(config => {
            let instance = instancesRef.current[config.id];

            if (!instance) {
                switch (config.type) {
                    case 'EMA':
                        instance = new EMAIndicator(chart, config);
                        break;
                    case 'HMA':
                        instance = new HMAIndicator(chart, config);
                        break;
                    case 'RSI':
                        instance = new RSIIndicator(chart, config);
                        break;
                    case 'Signals': // Strategies/Signals
                        instance = new SignalIndicator(mainSeries, config);
                        break;
                }
                if (instance) instancesRef.current[config.id] = instance;
            }

            if (instance) {
                instance.update(candles, config);
            }
        });

    }, [chartId, indicators, candles, symbol, chartRef, seriesRef]);

    // Cleanup all on unmount
    useEffect(() => {
        return () => {
            const instances = instancesRef.current;
            if (!instances) return;

            Object.values(instances).forEach(inst => {
                try {
                    if (inst && typeof inst.destroy === 'function') {
                        inst.destroy();
                    }
                } catch (err) {
                    console.warn('[Indicators] Unmount cleanup failed:', err);
                }
            });
            instancesRef.current = {};
        };
    }, []);
}
