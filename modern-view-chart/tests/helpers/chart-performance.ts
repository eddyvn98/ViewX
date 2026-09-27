import type { Page } from '@playwright/test';

export type ChartPerfSnapshot = {
    longTasks: number[];
    frameGaps: number[];
    canvasCount: number;
    domCount: number;
    heapUsed?: number;
};

export type BrowserErrorSnapshot = {
    pageErrors: string[];
    consoleErrors: string[];
};

const browserErrors = new WeakMap<Page, BrowserErrorSnapshot>();

export async function installChartPerfProbe(page: Page) {
    const errors: BrowserErrorSnapshot = { pageErrors: [], consoleErrors: [] };
    browserErrors.set(page, errors);

    page.on('pageerror', (error) => {
        errors.pageErrors.push(error.message);
    });
    page.on('console', (message) => {
        if (message.type() === 'error') errors.consoleErrors.push(message.text());
    });

    await page.addInitScript(() => {
        const state = {
            longTasks: [] as number[],
            frameGaps: [] as number[],
            lastFrame: 0,
        };
        (window as any).__VIEWX_PERF__ = state;

        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration >= 50) state.longTasks.push(entry.duration);
                    }
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch {
                // Long Task API is not available in every browser/runtime.
            }
        }

        const sampleFrame = (now: number) => {
            if (state.lastFrame > 0) {
                const gap = now - state.lastFrame;
                if (gap >= 20) state.frameGaps.push(gap);
            }
            state.lastFrame = now;
            requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
    });
}

export function readBrowserErrors(page: Page): BrowserErrorSnapshot {
    const errors = browserErrors.get(page);
    return errors
        ? { pageErrors: [...errors.pageErrors], consoleErrors: [...errors.consoleErrors] }
        : { pageErrors: [], consoleErrors: [] };
}

export async function readChartPerfSnapshot(page: Page): Promise<ChartPerfSnapshot> {
    return page.evaluate(() => {
        const perf = (window as any).__VIEWX_PERF__ || { longTasks: [], frameGaps: [] };
        const memory = (performance as any).memory;
        return {
            longTasks: [...perf.longTasks],
            frameGaps: [...perf.frameGaps],
            canvasCount: document.querySelectorAll('canvas').length,
            domCount: document.querySelectorAll('*').length,
            heapUsed: memory?.usedJSHeapSize,
        };
    });
}
