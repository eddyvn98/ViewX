import { IndicatorCache } from './indicator-calculations';

export const formatPrice = (p: number, digits: number = 2) => {
    if (isNaN(p)) return '...';
    const absP = Math.abs(p);
    if (p === 0) return (0).toFixed(digits);
    if (absP < 0.000001) return p.toExponential(4);
    return p.toFixed(digits);
};

export interface OHLCRefs {
    open: HTMLElement | null;
    high: HTMLElement | null;
    low: HTMLElement | null;
    close: HTMLElement | null;
    change: HTMLElement | null;
    changePercent: HTMLElement | null;
    statusDot: HTMLElement | null;
    statusText: HTMLElement | null;
    container: HTMLElement | null;
}

export const getOHLCRefs = (container: HTMLElement): OHLCRefs => ({
    open: container.querySelector('[data-ohlc="open"]'),
    high: container.querySelector('[data-ohlc="high"]'),
    low: container.querySelector('[data-ohlc="low"]'),
    close: container.querySelector('[data-ohlc="close"]'),
    change: container.querySelector('[data-ohlc="change"]'),
    changePercent: container.querySelector('[data-ohlc="change-percent"]'),
    statusDot: container.querySelector('[data-status="dot"]'),
    statusText: container.querySelector('[data-status="text"]'),
    container: container.querySelector('[data-legend-container]'),
});

export const getIndicatorRefs = (container: HTMLElement, indicators: IndicatorCache[]) => {
    const refs = new Map<string, { container: HTMLElement; value: HTMLElement; spans?: NodeListOf<HTMLSpanElement> }>();
    const indicatorContainer = container.querySelector('[data-indicators]');
    if (indicatorContainer) {
        indicators.forEach((ind) => {
            const el = indicatorContainer.querySelector(`[data-indicator-id="${ind.id}"]`) as HTMLElement;
            if (!el) return;
            const valueEl = el.querySelector('[data-indicator-value]') as HTMLElement;
            if (!valueEl) return;
            refs.set(ind.id, { container: el, value: valueEl, spans: valueEl.querySelectorAll('span') });
        });
    }
    return refs;
};

const getSeriesEntries = (results: IndicatorCache['results']): Array<[string, number[]]> => {
    if (Array.isArray(results)) return [['value', results]];
    if (!results || typeof results !== 'object') return [];
    return Object.entries(results).filter((entry): entry is [string, number[]] => Array.isArray(entry[1]));
};

const getSeriesLabel = (seriesName: string): string => {
    const key = seriesName.toLowerCase();
    if (key === 'k') return '%K';
    if (key === 'd') return '%D';
    if (key === 'macd') return 'M';
    if (key === 'signal') return 'S';
    if (key === 'histogram') return 'H';
    if (key === 'plusdi') return '+DI';
    if (key === 'minusdi') return '-DI';
    if (key === 'adx') return 'ADX';
    return seriesName.toUpperCase();
};

const getSeriesColor = (seriesName: string, value: number, fallback: string): string => {
    const key = seriesName.toLowerCase();
    if (key === 'signal' || key === 'd') return '#FF6D00';
    if (key === 'plusdi' || key === 'k') return '#2196F3';
    if (key === 'minusdi') return '#ef5350';
    if (key === 'adx') return '#FFB74D';
    if (key === 'histogram') return value >= 0 ? '#26a69a' : '#ef5350';
    return fallback;
};

export const renderOHLC = (
    refs: OHLCRefs,
    open: number,
    high: number,
    low: number,
    close: number,
    digits: number = 2
) => {
    const changeValue = close - open;
    const changePercent = open !== 0 ? (changeValue / open * 100) : 0;
    const isPositive = changeValue >= 0;

    if (refs.open) refs.open.textContent = formatPrice(open, digits);
    if (refs.high) refs.high.textContent = formatPrice(high, digits);
    if (refs.low) refs.low.textContent = formatPrice(low, digits);
    if (refs.close) {
        refs.close.textContent = formatPrice(close, digits);
        refs.close.classList.remove('text-blue-500', 'text-rose-500', 'text-green-500', 'text-red-500');
        refs.close.classList.add(isPositive ? 'text-blue-500' : 'text-rose-500');
    }
    if (refs.change) {
        refs.change.textContent = (isPositive ? '+' : '') + formatPrice(changeValue, digits);
        refs.change.classList.remove('text-blue-500', 'text-rose-500');
        refs.change.classList.add(isPositive ? 'text-blue-500' : 'text-rose-500');
    }
    if (refs.changePercent) {
        refs.changePercent.textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
        refs.changePercent.classList.remove('text-blue-500', 'text-rose-500');
        refs.changePercent.classList.add(isPositive ? 'text-blue-500' : 'text-rose-500');
    }
};

export const renderStatus = (refs: OHLCRefs, isLive: boolean) => {
    if (refs.statusDot) {
        refs.statusDot.className = isLive
            ? 'w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse'
            : 'w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
    }
    if (refs.statusText) {
        refs.statusText.textContent = isLive ? 'Live' : 'Historical';
        refs.statusText.classList.remove('text-emerald-500', 'text-amber-500');
        refs.statusText.classList.add(isLive ? 'text-emerald-500' : 'text-amber-500');
    }
    if (refs.container) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (isLive) {
            refs.container.classList.remove('bg-amber-500/10', 'border-amber-500/20');
            if (!isMobile) refs.container.classList.add('bg-primary/5', 'border-primary/10');
        } else {
            refs.container.classList.remove('bg-primary/5', 'border-primary/10', 'bg-transparent', 'border-none');
            if (!isMobile) refs.container.classList.add('bg-amber-500/10', 'border-amber-500/20');
            else refs.container.classList.add('bg-transparent', 'border-none');
        }
    }
};

export const renderIndicators = (
    activeIndex: number,
    indicators: IndicatorCache[],
    indicatorRefs: Map<string, { container: HTMLElement; value: HTMLElement; spans?: NodeListOf<HTMLSpanElement> }>,
    targetPane?: string
) => {
    indicators
        .filter((ind) => (targetPane ? ind.pane === targetPane : ind.pane !== 'subchart'))
        .forEach((ind) => {
            const cached = indicatorRefs.get(ind.id);
            if (!cached) return;

            const seriesEntries = getSeriesEntries(ind.results);
            if (seriesEntries.length === 0) return;

            // Single-series indicators: use first span or fallback text node.
            if (seriesEntries.length === 1 && seriesEntries[0][0] === 'value') {
                const values = seriesEntries[0][1];
                const idx = Math.min(activeIndex, values.length - 1);
                const val = values[idx];
                const span = cached.spans?.[0] ?? cached.value.querySelector('span');
                if (span) span.textContent = isNaN(val) ? '-' : val.toFixed(2);
                else cached.value.textContent = isNaN(val) ? '...' : val.toFixed(2);
                return;
            }

            seriesEntries.forEach(([seriesName, values], i) => {
                const idx = Math.min(activeIndex, values.length - 1);
                const val = values[idx];
                const span = cached.spans?.[i];
                if (!span) return;
                const label = getSeriesLabel(seriesName);
                span.textContent = isNaN(val) ? `${label} -` : `${label} ${val.toFixed(2)}`;
                span.style.color = getSeriesColor(seriesName, val, span.style.color || '#ffffff');
            });

            if (cached.spans && seriesEntries.length > 0) {
                for (let i = seriesEntries.length; i < cached.spans.length; i += 1) {
                    cached.spans[i].textContent = '-';
                }
            }
        });
};
