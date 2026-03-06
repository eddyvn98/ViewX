import { Candle } from '@/lib/store';
import { useMarketStore } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { renderOHLC, renderStatus, renderIndicators, OHLCRefs } from '../logic/legend-renderer';

export function updateLegendDirect(
    activeIndex: number,
    isLive: boolean,
    currentPrice: number | undefined,
    rawCandles: Candle[],
    displayCandles: any[],
    indicators: IndicatorCache[],
    ohlcRefs: OHLCRefs | null,
    lastUpdateAtRef: React.MutableRefObject<number>,
    lastIsLiveRef: React.MutableRefObject<boolean | null>,
    chartType: string,
    chartId: string,
    indicatorRefs: Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>,
    digits: number = 2,
    recalculateLiveIndicators: boolean = false
) {
    if (!rawCandles.length || !ohlcRefs) return;

    const now = Date.now();
    if (isLive && (now - lastUpdateAtRef.current < 32)) return;
    lastUpdateAtRef.current = now;

    const candle = displayCandles[activeIndex] || displayCandles[displayCandles.length - 1];
    if (!candle) return;

    let { open, high, low, close } = candle;

    if (isLive && currentPrice) {
        if (chartType === 'heikin_ashi') {
            const rawCandle = rawCandles[activeIndex] || rawCandles[rawCandles.length - 1];
            const haOpen = Number(candle.open);
            const rawClose = Number(currentPrice);
            const rawHigh = Math.max(Number(rawCandle.high), rawClose);
            const rawLow = Math.min(Number(rawCandle.low), rawClose);
            const rawOpen = Number(rawCandle.open);

            const haClose = (rawOpen + rawHigh + rawLow + rawClose) / 4;
            open = haOpen;
            high = Math.max(rawHigh, haOpen, haClose);
            low = Math.min(rawLow, haOpen, haClose);
            close = haClose;
        } else {
            close = currentPrice;
            if (close > high) high = close;
            if (close < low) low = close;
        }
    }

    renderOHLC(ohlcRefs, open, high, low, close, digits);

    if (lastIsLiveRef.current !== isLive) {
        lastIsLiveRef.current = isLive;
        renderStatus(ohlcRefs, isLive);
    }

    if (recalculateLiveIndicators && isLive && currentPrice && activeIndex === rawCandles.length - 1) {
        const storeIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
        const updatedCandles = rawCandles.map((c, idx) =>
            idx === rawCandles.length - 1 ? { ...c, close: currentPrice } : c
        );
        const recalculated = calculateIndicators(updatedCandles, storeIndicators);

        const tempCaches = indicators.map(cache => {
            const match = recalculated.find(r => r.id === cache.id);
            if (!match) return cache;
            const res = match.results;
            const lastValue = Array.isArray(res)
                ? res[res.length - 1]
                : (res as any).macd?.[(res as any).macd.length - 1];
            return {
                ...cache,
                results: [...(Array.isArray(cache.results) ? cache.results.slice(0, -1) : []), lastValue]
            };
        });
        renderIndicators(activeIndex, tempCaches as any, indicatorRefs);
    } else {
        renderIndicators(activeIndex, indicators, indicatorRefs);
    }
}
