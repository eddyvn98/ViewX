import { useMarketStore, Candle } from '@/lib/store';
import { calculateHeikinAshi } from '../utils/indicator-math';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';

export interface CrosshairPoint {
    x?: number;
    y?: number;
}

export interface CrosshairEventDetail {
    time?: number | null;
    sourceId?: string;
    sourcePane?: 'price' | 'subchart' | 'timescale';
    point?: CrosshairPoint;
    sourceRect?: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    sourceEvent?: {
        clientX?: number;
        clientY?: number;
        pointerType?: string;
        isTouch?: boolean;
    };
}

const MOBILE_BREAKPOINT = 768;
const LEGEND_MARGIN_X = 8;
const LEGEND_GAP_X = 14;
const LEGEND_FALLBACK_WIDTH = 180;

export const getFreshCandles = (
    symbol: string,
    interval: string,
    source: string,
    chartType: string
): { raw: Candle[]; display: Candle[] } => {
    const normSym = normalizeSymbol(symbol);
    const key = `${source}:${normSym}:${interval}`;
    const rawCandles = useMarketStore.getState().candleData[key] || [];

    if (chartType === 'heikin_ashi' && rawCandles.length > 0) {
        const haData = calculateHeikinAshi(rawCandles);
        return {
            raw: rawCandles,
            display: haData.map(c => ({
                ...c,
                open: c.ha_open,
                high: c.ha_high,
                low: c.ha_low,
                close: c.ha_close
            }))
        };
    }

    return { raw: rawCandles, display: rawCandles };
};

export const findCandleIndex = (targetTime: number, candlesArray: Candle[]): number => {
    if (!candlesArray.length) return 0;
    const target = toSec(targetTime);
    let low = 0;
    let high = candlesArray.length - 1;

    while (low <= high) {
        const mid = (low + high) >> 1;
        const midTime = toSec(candlesArray[mid].time);
        if (midTime === target) return mid;
        if (midTime < target) low = mid + 1;
        else high = mid - 1;
    }

    return Math.max(0, Math.min(high, candlesArray.length - 1));
};

export const getTickerPrice = (tickerKey: string, normalizedSymbol: string) => {
    const store = useMarketStore.getState();
    return store.tickers[tickerKey]?.price || store.tickers[normalizedSymbol]?.price;
};

export const getSymbolDigits = (symbol: string) => useMarketStore.getState().symbolInfo[symbol]?.digits || 2;

export const resetLegendPosition = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    lastLegendXRef: React.MutableRefObject<number | null>
) => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    containerEl.style.left = '';
    lastLegendXRef.current = null;
};

export const moveLegendNearCrosshair = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    lastLegendXRef: React.MutableRefObject<number | null>,
    pointX?: number
) => {
    const containerEl = containerRef.current;
    if (!containerEl || typeof pointX !== 'number') return;
    if (window.innerWidth < MOBILE_BREAKPOINT) return;

    const parentEl = containerEl.parentElement;
    if (!parentEl) return;

    const legendWidth = containerEl.offsetWidth || LEGEND_FALLBACK_WIDTH;
    const parentWidth = parentEl.clientWidth || 0;
    if (parentWidth <= 0) return;

    const maxX = Math.max(LEGEND_MARGIN_X, parentWidth - legendWidth - LEGEND_MARGIN_X);
    const desiredX = pointX + LEGEND_GAP_X > maxX
        ? pointX - legendWidth - LEGEND_GAP_X
        : pointX + LEGEND_GAP_X;
    const nextX = Math.round(Math.max(LEGEND_MARGIN_X, Math.min(maxX, desiredX)));

    if (lastLegendXRef.current === nextX) return;
    containerEl.style.left = `${nextX}px`;
    lastLegendXRef.current = nextX;
};

export const getNormalizedSymbol = normalizeSymbol;
