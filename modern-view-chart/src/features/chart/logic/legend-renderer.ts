import { IndicatorCache } from './indicator-calculations';

export const formatPrice = (p: number) => {
    if (p === 0) return '0.00';
    if (p < 0.0001) return p.toExponential(4);
    if (p < 1) return p.toFixed(5);
    if (p < 100) return p.toFixed(3);
    return p.toFixed(2);
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
    close: number
) => {
    const changeValue = close - open;
    const changePercent = open !== 0 ? (changeValue / open * 100) : 0;
    const isPositive = changeValue >= 0;
    const color = isPositive ? '#22c55e' : '#ef4444';

    if (refs.open) refs.open.textContent = formatPrice(open);
    if (refs.high) refs.high.textContent = formatPrice(high);
    if (refs.low) refs.low.textContent = formatPrice(low);
    if (refs.close) {
        refs.close.textContent = formatPrice(close);
        refs.close.style.color = color;
    }
    if (refs.change) {
        refs.change.textContent = (isPositive ? '+' : '') + formatPrice(changeValue);
        refs.change.style.color = color;
    }
    if (refs.changePercent) {
        refs.changePercent.textContent = `(${changePercent.toFixed(2)}%)`;
        refs.changePercent.style.color = color;
    }
};

export const renderStatus = (refs: OHLCRefs, isLive: boolean) => {
    if (refs.statusDot) {
        refs.statusDot.className = isLive
            ? 'w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
            : 'w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
    }
    if (refs.statusText) {
        refs.statusText.textContent = isLive ? 'Live' : 'Historical';
        refs.statusText.style.color = isLive ? '#22c55e' : '#f97316';
    }
    if (refs.container) {
        if (isLive) {
            refs.container.style.backgroundColor = 'rgba(9, 9, 11, 0.8)';
            refs.container.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        } else {
            refs.container.style.backgroundColor = 'rgba(249, 115, 22, 0.1)';
            refs.container.style.borderColor = 'rgba(249, 115, 22, 0.4)';
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
                cached.value.textContent = isNaN(val) ? '···' : val.toFixed(2);
            }
        });
};
