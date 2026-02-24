import { IndicatorCache } from './indicator-calculations';

export const formatPrice = (p: number, digits: number = 2) => {
    if (isNaN(p)) return '···';
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
    container: container.querySelector('[data-legend-container]')
});

export const getIndicatorRefs = (container: HTMLElement, indicators: IndicatorCache[]) => {
    const refs = new Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>();
    const indicatorContainer = container.querySelector('[data-indicators]');
    if (indicatorContainer) {
        indicators.forEach(ind => {
            const el = indicatorContainer.querySelector(`[data-indicator-id="${ind.id}"]`) as HTMLElement;
            if (el) {
                const valueEl = el.querySelector('[data-indicator-value]') as HTMLElement;
                if (valueEl) {
                    refs.set(ind.id, {
                        container: el,
                        value: valueEl,
                        spans: ind.type === 'MACD' ? valueEl.querySelectorAll('span') : undefined
                    });
                }
            }
        });
    }
    return refs;
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
    const color = isPositive ? 'text-blue-500' : 'text-rose-500';

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
            if (!isMobile) {
                refs.container.classList.add('bg-amber-500/10', 'border-amber-500/20');
            } else {
                refs.container.classList.add('bg-transparent', 'border-none');
            }
        }
    }
};

export const renderIndicators = (
    activeIndex: number,
    indicators: IndicatorCache[],
    indicatorRefs: Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>,
    targetPane?: string
) => {
    indicators
        .filter(ind => targetPane ? ind.pane === targetPane : ind.pane !== 'subchart')
        .forEach(ind => {
            const cached = indicatorRefs.get(ind.id);
            if (!cached) return;

            if (ind.type === 'MACD') {
                const results = ind.results as { macd: number[]; signal: number[]; histogram: number[] };
                const idx = Math.min(activeIndex, results.macd.length - 1);
                const macdVal = results.macd[idx];
                const sigVal = results.signal[idx];
                const histVal = results.histogram[idx];

                const spans = cached.spans;
                if (spans) {
                    if (spans[0]) spans[0].textContent = isNaN(macdVal) ? '-' : macdVal.toFixed(2);
                    if (spans[1]) spans[1].textContent = isNaN(sigVal) ? '-' : sigVal.toFixed(2);
                    if (spans[2]) {
                        spans[2].textContent = isNaN(histVal) ? '-' : histVal.toFixed(2);
                        spans[2].style.color = histVal >= 0 ? '#26a69a' : '#ef5350';
                    }
                }
            } else {
                const results = ind.results as number[];
                const idx = Math.min(activeIndex, results.length - 1);
                const val = results[idx];
                if (cached.value) {
                    const span = cached.value.querySelector('span');
                    if (span) {
                        span.textContent = isNaN(val) ? '-' : val.toFixed(2);
                    } else {
                        cached.value.textContent = isNaN(val) ? '···' : val.toFixed(2);
                    }
                }
            }
        });
};
