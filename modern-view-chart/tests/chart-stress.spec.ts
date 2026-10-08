import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
    installChartPerfProbe,
    readBrowserErrors,
    readChartPerfSnapshot,
    summarizeChartPerf,
} from './helpers/chart-performance';

async function attachDiagnostics(page: Page, testInfo: TestInfo) {
    const metrics = await readChartPerfSnapshot(page);
    const summary = summarizeChartPerf(metrics);
    const errors = readBrowserErrors(page);

    await testInfo.attach('performance-metrics.json', {
        body: Buffer.from(JSON.stringify(metrics, null, 2)),
        contentType: 'application/json',
    });
    await testInfo.attach('performance-budget-summary.json', {
        body: Buffer.from(JSON.stringify(summary, null, 2)),
        contentType: 'application/json',
    });
    await testInfo.attach('browser-errors.json', {
        body: Buffer.from(JSON.stringify(errors, null, 2)),
        contentType: 'application/json',
    });

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
    expect(metrics.canvasCount).toBeGreaterThan(0);
    expect(summary.maxLongTaskMs).toBeLessThanOrEqual(1000);
    expect(summary.maxFrameGapMs).toBeLessThanOrEqual(1500);
}

async function chartPoint(page: Page, xRatio: number, yRatio: number) {
    const chartSurface = page.getByTestId('chart-price-e2e-chart');
    const box = await chartSurface.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) throw new Error('Visible chart surface is unavailable');

    // Interact with the stable price-container surface, not Lightweight Charts'
    // internal canvases. The library can add/reorder/transform canvases for scales
    // and primitives, so their DOM geometry is not a stable user interaction area.
    const left = Math.max(0, box.x) + 16;
    const right = Math.min(viewport.width, box.x + box.width) - 80;
    const top = Math.max(0, box.y) + 16;
    const bottom = Math.min(viewport.height, box.y + box.height) - 16;
    if (right <= left || bottom <= top) throw new Error('Chart surface is outside the viewport');

    return {
        x: left + (right - left) * xRatio,
        y: top + (bottom - top) * yRatio,
    };
}

async function dispatchDrawingPointer(page: Page, xRatio: number, yRatio: number) {
    await page.evaluate(({ xRatio, yRatio }) => {
        const surface = document.querySelector('[data-testid="chart-price-e2e-chart"]') as HTMLElement | null;
        const root = document.querySelector('[data-testid="chart-container-e2e-chart"]') as HTMLElement | null;
        if (!surface || !root) throw new Error('Chart drawing surface is unavailable');

        const surfaceRect = surface.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const left = Math.max(0, surfaceRect.left, rootRect.left) + 24;
        const right = Math.min(window.innerWidth, surfaceRect.right, rootRect.right) - 96;
        const top = Math.max(0, surfaceRect.top, rootRect.top) + 24;
        const bottom = Math.min(window.innerHeight, surfaceRect.bottom, rootRect.bottom) - 48;
        if (right <= left || bottom <= top) throw new Error('Chart drawing surface is outside the viewport');

        const clientX = left + (right - left) * xRatio;
        const clientY = top + (bottom - top) * yRatio;
        const base = {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX,
            clientY,
            button: 0,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
        };

        surface.dispatchEvent(new PointerEvent('pointermove', { ...base, buttons: 0 }));
        surface.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
        surface.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
    }, { xRatio, yRatio });
}

async function drawTwoPointTool(page: Page, tool: 'trend-line' | 'rectangle' | 'fib-retracement') {
    await page.evaluate((drawingTool) => window.__VIEWX_E2E__?.startDrawing(drawingTool), tool);

    // Dispatch native pointer events without Playwright auto-scroll. Locator.click()
    // may scroll transformed chart internals between point 1 and point 2, which can
    // move the second absolute coordinate outside the viewport in headless Chromium.
    await dispatchDrawingPointer(page, 0.35, 0.35);
    await expect.poll(async () =>
        page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().tempPoints ?? -1)
    ).toBe(1);

    await dispatchDrawingPointer(page, 0.65, 0.62);
    await expect.poll(async () =>
        page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().isDrawing ?? true)
    ).toBe(false);
}

test.describe('chart interaction stability', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
        await installChartPerfProbe(page);
        await page.goto('/en/chart', { waitUntil: 'domcontentloaded' });
        await expect.poll(async () =>
            page.evaluate(() => Boolean(window.__VIEWX_E2E__))
        ).toBe(true);
        await page.evaluate(() => window.__VIEWX_E2E__?.seed());
        await expect(page.getByTestId('chart-price-e2e-chart')).toBeVisible();
        await expect.poll(async () => page.locator('canvas').count()).toBeGreaterThan(0);
    });

    test('rapid timeframe switching finishes on the latest user choice', async ({ page }, testInfo) => {
        const sequence = ['1', '5', '15', '60', '240', '1', '60', '5'];
        for (let round = 0; round < 6; round += 1) {
            for (const interval of sequence) {
                await page.getByTestId(`timeframe-${interval}`).click();
            }
        }

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getChartState()?.interval)
        ).toBe('5');

        const chart = page.getByTestId('chart-container-e2e-chart');
        await expect(chart).toHaveAttribute('data-interval', '5');
        await expect(chart).toHaveAttribute('data-symbol', 'XAUUSDm');

        await attachDiagnostics(page, testInfo);
    });

    test('rapid symbol and timeframe churn preserves final context', async ({ page }, testInfo) => {
        const symbols = ['BTCUSDm', 'EURUSDm', 'XAUUSDm'];
        const intervals = ['1', '15', '60', '5'];

        for (let round = 0; round < 24; round += 1) {
            await page.evaluate(
                ({ symbol, interval }) => {
                    window.__VIEWX_E2E__?.setChartSymbol(symbol, 'MT5');
                    window.__VIEWX_E2E__?.setChartTimeframe(interval);
                },
                {
                    symbol: symbols[round % symbols.length],
                    interval: intervals[round % intervals.length],
                }
            );
        }

        await page.evaluate(() => {
            window.__VIEWX_E2E__?.setChartSymbol('EURUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('60');
        });

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getChartState())
        ).toMatchObject({ symbol: 'EURUSDm', interval: '60', source: 'MT5' });

        const chart = page.getByTestId('chart-container-e2e-chart');
        await expect(chart).toHaveAttribute('data-symbol', 'EURUSDm');
        await expect(chart).toHaveAttribute('data-interval', '60');

        await attachDiagnostics(page, testInfo);
    });

    test('switching to an uncached symbol cannot reuse the previous symbol candle', async ({ page }, testInfo) => {
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.setChartSymbol('BTCUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('1');
        });

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle())
        ).not.toBeNull();

        const btcLast = await page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle());
        expect(Number(btcLast?.close || 0)).toBeGreaterThan(10000);

        await page.evaluate(() => window.__VIEWX_E2E__?.resetPerfCounters());
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.setChartSymbol('UNSEEDEDUSDm', 'MT5');
        });

        await expect(page.getByTestId('chart-container-e2e-chart')).toHaveAttribute('data-symbol', 'UNSEEDEDUSDm');

        // A ticker can arrive before history for the new symbol. It must NOT use
        // BTC's last candle as the base and must not create a corrupted new buffer.
        await page.evaluate(() => window.__VIEWX_E2E__?.burstTicks(120));
        await page.evaluate(() => new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        ));

        const targetLast = await page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle());
        expect(targetLast).toBeNull();

        const counters = await page.evaluate(() => window.__VIEWX_E2E__?.getPerfCounters());
        expect(counters?.realtimeSeriesUpdates ?? 0).toBe(0);
        expect(counters?.historySetDataBatches ?? 0).toBeLessThanOrEqual(1);

        // Verify the chart can still recover immediately when switching back to
        // a context with valid history.
        await page.evaluate(() => window.__VIEWX_E2E__?.setChartSymbol('XAUUSDm', 'MT5'));
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle())
        ).not.toBeNull();

        const goldLast = await page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle());
        expect(Number(goldLast?.close || 0)).toBeLessThan(10000);

        await attachDiagnostics(page, testInfo);
    });

    test('symbol switch clears stale forecast before autoscale', async ({ page }, testInfo) => {
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.setChartSymbol('BTCUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('60');
        });

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getChartState())
        ).toMatchObject({ symbol: 'BTCUSDm', interval: '60', source: 'MT5' });

        await page.evaluate(() => window.__VIEWX_E2E__?.seedForecast(83000));
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getForecastState())
        ).toMatchObject({ symbol: 'BTCUSDm', interval: '60', source: 'MT5', firstPoint: 83000 });

        await page.evaluate(() => window.__VIEWX_E2E__?.setChartSymbol('XAUUSDm', 'MT5'));

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getChartState())
        ).toMatchObject({ symbol: 'XAUUSDm', interval: '60', source: 'MT5' });

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getForecastState() ?? null)
        ).toBeNull();

        const chart = page.getByTestId('chart-container-e2e-chart');
        await expect(chart).toHaveAttribute('data-symbol', 'XAUUSDm');
        await attachDiagnostics(page, testInfo);
    });

    test('pan zoom pointer and tick burst keep chart responsive', async ({ page }, testInfo) => {
        const center = await chartPoint(page, 0.55, 0.45);

        await page.mouse.move(center.x, center.y);
        for (let i = 0; i < 16; i += 1) {
            await page.mouse.wheel(0, i % 2 === 0 ? -240 : 180);
        }

        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        for (let i = 0; i < 40; i += 1) {
            await page.mouse.move(
                center.x + (i % 2 === 0 ? 150 : -150),
                center.y + Math.sin(i) * 20,
                { steps: 1 }
            );
        }
        await page.mouse.up();

        const beforeBurst = await page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle());
        expect(beforeBurst).toBeTruthy();
        await page.evaluate(() => window.__VIEWX_E2E__?.resetPerfCounters());
        await page.evaluate(() => window.__VIEWX_E2E__?.burstTicks(500));
        await page.evaluate(() => new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        ));
        await page.mouse.move(center.x + 40, center.y + 20);
        await page.mouse.move(center.x - 80, center.y - 25, { steps: 30 });

        await expect(page.getByTestId('chart-container-e2e-chart')).toHaveAttribute('data-symbol', 'XAUUSDm');

        const counters = await page.evaluate(() => window.__VIEWX_E2E__?.getPerfCounters());
        expect(counters).toBeTruthy();
        expect(counters?.tickerMessages).toBe(500);
        expect(counters?.tickerFrames).toBeLessThanOrEqual(2);
        expect(counters?.realtimeSeriesUpdates).toBeLessThanOrEqual(2);
        expect(counters?.historySetDataBatches).toBe(0);

        const afterBurst = await page.evaluate(() => window.__VIEWX_E2E__?.getLastCandle());
        expect(afterBurst).toBeTruthy();
        if (beforeBurst && afterBurst) {
            const start = Number(beforeBurst.close);
            const prices = Array.from({ length: 500 }, (_, index) =>
                start + Math.sin(index / 5) * (start * 0.0005)
            );
            const expectedHigh = Math.max(Number(beforeBurst.high), ...prices);
            const expectedLow = Math.min(Number(beforeBurst.low), ...prices);
            expect(Number(afterBurst.high)).toBeCloseTo(expectedHigh, 6);
            expect(Number(afterBurst.low)).toBeCloseTo(expectedLow, 6);
            expect(Number(afterBurst.close)).toBeCloseTo(prices[prices.length - 1], 6);
        }

        await testInfo.attach('chart-perf-counters.json', {
            body: Buffer.from(JSON.stringify(counters, null, 2)),
            contentType: 'application/json',
        });
        await attachDiagnostics(page, testInfo);
    });

    test('indicator worker churn cannot restore removed indicators', async ({ page }, testInfo) => {
        await page.evaluate(() => window.__VIEWX_E2E__?.clearIndicators());
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getIndicatorState().configured.length ?? -1)
        ).toBe(0);

        const stressTypes = ['RSI', 'MACD', 'BollingerBands', 'Ichimoku', 'ATR', 'ADX'];
        for (let round = 0; round < 4; round += 1) {
            for (const type of stressTypes) {
                await page.evaluate((indicatorType) => window.__VIEWX_E2E__?.addIndicator(indicatorType), type);
                await page.waitForTimeout(12);
            }
            await page.evaluate(() => window.__VIEWX_E2E__?.clearIndicators());
            await page.waitForTimeout(20);
        }

        for (const type of ['RSI', 'MACD', 'BollingerBands']) {
            await page.evaluate((indicatorType) => window.__VIEWX_E2E__?.addIndicator(indicatorType), type);
        }

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getIndicatorState().configured.map((item) => item.type) ?? [])
        ).toEqual(['RSI', 'MACD', 'BollingerBands']);

        await page.waitForTimeout(500);
        const state = await page.evaluate(() => window.__VIEWX_E2E__?.getIndicatorState());
        expect(state).toBeTruthy();
        const configuredIds = new Set(state?.configured.map((item) => item.id) ?? []);
        for (const runtime of state?.runtime ?? []) {
            expect(configuredIds.has(runtime.id)).toBe(true);
        }

        await attachDiagnostics(page, testInfo);
    });

    test('rapid indicator parameter edits preserve only the latest configuration', async ({ page }, testInfo) => {
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.clearIndicators();
            window.__VIEWX_E2E__?.addIndicator('RSI');
        });

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getIndicatorState().configured.length ?? -1)
        ).toBe(1);

        for (let period = 2; period <= 80; period += 1) {
            await page.evaluate((nextPeriod) => {
                window.__VIEWX_E2E__?.updateFirstIndicatorParams({ period: nextPeriod });
            }, period);
        }
        await page.evaluate(() => window.__VIEWX_E2E__?.updateFirstIndicatorParams({ period: 37 }));

        await expect.poll(async () =>
            page.evaluate(() => Number(window.__VIEWX_E2E__?.getIndicatorState().configured[0]?.params?.period ?? -1))
        ).toBe(37);

        await expect.poll(async () =>
            page.evaluate(() => Number(window.__VIEWX_E2E__?.getIndicatorState().runtime[0]?.params?.period ?? -1))
        ).toBe(37);

        await page.waitForTimeout(500);
        const state = await page.evaluate(() => window.__VIEWX_E2E__?.getIndicatorState());
        expect(state?.configured).toHaveLength(1);
        expect(state?.runtime).toHaveLength(1);
        expect(state?.runtime[0]?.id).toBe(state?.configured[0]?.id);
        expect(Number(state?.runtime[0]?.params?.period)).toBe(37);

        await attachDiagnostics(page, testInfo);
    });

    test('drawing primitives survive rapid create and clear cycles', async ({ page }, testInfo) => {
        await page.evaluate(() => window.__VIEWX_E2E__?.clearDrawings());

        let expectedCount = 0;
        for (const tool of ['trend-line', 'rectangle', 'fib-retracement'] as const) {
            await drawTwoPointTool(page, tool);
            expectedCount += 1;
            await expect.poll(async () =>
                page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
            ).toBe(expectedCount);
            await expect.poll(async () =>
                page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().isDrawing ?? true)
            ).toBe(false);
        }

        for (let round = 0; round < 3; round += 1) {
            await page.evaluate(() => window.__VIEWX_E2E__?.clearDrawings());
            await expect.poll(async () =>
                page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
            ).toBe(0);
            await drawTwoPointTool(page, 'trend-line');
            await expect.poll(async () =>
                page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
            ).toBe(1);
        }

        await page.evaluate(() => window.__VIEWX_E2E__?.clearDrawings());
        const finalState = await page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState());
        expect(finalState).toMatchObject({
            count: 0,
            isDrawing: false,
            currentTool: 'none',
            tempPoints: 0,
        });

        await attachDiagnostics(page, testInfo);
    });

    test('drawing move resize delete churn keeps state bounded', async ({ page }, testInfo) => {
        await page.evaluate(() => window.__VIEWX_E2E__?.clearDrawings());
        await page.evaluate(() => window.__VIEWX_E2E__?.addDrawingFixture());

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
        ).toBe(1);

        for (let index = 0; index < 80; index += 1) {
            await page.evaluate((step) => {
                window.__VIEWX_E2E__?.moveFirstDrawing(step % 2 === 0 ? 60 : -60, step % 2 === 0 ? 0.5 : -0.5);
                window.__VIEWX_E2E__?.resizeFirstDrawing(30, step % 2 === 0 ? 0.25 : -0.25);
            }, index);
        }

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
        ).toBe(1);

        await page.evaluate(() => window.__VIEWX_E2E__?.deleteFirstDrawing());
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
        ).toBe(0);

        const finalState = await page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState());
        expect(finalState).toMatchObject({
            count: 0,
            isDrawing: false,
            tempPoints: 0,
        });

        await attachDiagnostics(page, testInfo);
    });

    test('repeated chart churn releases temporary resources', async ({ page }, testInfo) => {
        // Warm up lazy UI/series/primitives once. Leak detection should measure
        // continued growth across repeated churn, not legitimate one-time mounts.
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.setChartSymbol('BTCUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('5');
            window.__VIEWX_E2E__?.addIndicator('RSI');
            window.__VIEWX_E2E__?.addIndicator('MACD');
            window.__VIEWX_E2E__?.addDrawingFixture();
        });
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
        ).toBe(1);
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.clearIndicators();
            window.__VIEWX_E2E__?.clearDrawings();
            window.__VIEWX_E2E__?.setChartSymbol('XAUUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('1');
        });
        await page.waitForTimeout(400);

        const before = await readChartPerfSnapshot(page);

        for (let round = 0; round < 6; round += 1) {
            await page.evaluate(({ symbol, interval }) => {
                window.__VIEWX_E2E__?.setChartSymbol(symbol, 'MT5');
                window.__VIEWX_E2E__?.setChartTimeframe(interval);
                window.__VIEWX_E2E__?.clearIndicators();
                window.__VIEWX_E2E__?.addIndicator('RSI');
                window.__VIEWX_E2E__?.addIndicator('MACD');
            }, {
                symbol: round % 2 === 0 ? 'BTCUSDm' : 'XAUUSDm',
                interval: round % 2 === 0 ? '5' : '15',
            });

            await page.evaluate(() => window.__VIEWX_E2E__?.addDrawingFixture());
            await expect.poll(async () =>
                page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
            ).toBe(1);
            await page.evaluate(() => new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            ));
            await page.evaluate(() => window.__VIEWX_E2E__?.clearDrawings());
            await page.evaluate(() => window.__VIEWX_E2E__?.clearIndicators());
        }

        await page.evaluate(() => {
            window.__VIEWX_E2E__?.clearIndicators();
            window.__VIEWX_E2E__?.clearDrawings();
            window.__VIEWX_E2E__?.setChartSymbol('XAUUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('1');
        });
        await page.waitForTimeout(500);

        const after = await readChartPerfSnapshot(page);
        const finalState = await page.evaluate(() => ({
            chart: window.__VIEWX_E2E__?.getChartState(),
            indicators: window.__VIEWX_E2E__?.getIndicatorState(),
            drawings: window.__VIEWX_E2E__?.getDrawingState(),
        }));

        await testInfo.attach('resource-leak-metrics.json', {
            body: Buffer.from(JSON.stringify({ before, after, finalState }, null, 2)),
            contentType: 'application/json',
        });

        expect(finalState.chart).toMatchObject({ symbol: 'XAUUSDm', interval: '1', source: 'MT5' });
        expect(finalState.indicators?.configured ?? []).toEqual([]);
        expect(finalState.drawings).toMatchObject({ count: 0, isDrawing: false, tempPoints: 0 });
        expect(after.canvasCount).toBeLessThanOrEqual(before.canvasCount + 2);
        expect(after.domCount).toBeLessThanOrEqual(before.domCount + 80);
        if (typeof before.heapUsed === 'number' && typeof after.heapUsed === 'number') {
            const heapGrowth = after.heapUsed - before.heapUsed;
            expect(heapGrowth).toBeLessThanOrEqual(64 * 1024 * 1024);
        }

        await attachDiagnostics(page, testInfo);
    });

    test('mixed chaos finishes with one deterministic state', async ({ page }, testInfo) => {
        await page.evaluate(() => {
            window.__VIEWX_E2E__?.clearIndicators();
            window.__VIEWX_E2E__?.clearDrawings();
        });

        const symbols = ['BTCUSDm', 'EURUSDm', 'XAUUSDm'];
        const intervals = ['1', '5', '15', '60', '240'];
        const indicators = ['RSI', 'MACD', 'ATR', 'ADX'];

        for (let round = 0; round < 12; round += 1) {
            await page.evaluate(
                ({ symbol, interval, indicator, clearIndicators }) => {
                    window.__VIEWX_E2E__?.setChartSymbol(symbol, 'MT5');
                    window.__VIEWX_E2E__?.setChartTimeframe(interval);
                    window.__VIEWX_E2E__?.addIndicator(indicator);
                    if (clearIndicators) window.__VIEWX_E2E__?.clearIndicators();
                    window.__VIEWX_E2E__?.burstTicks(60);
                },
                {
                    symbol: symbols[round % symbols.length],
                    interval: intervals[round % intervals.length],
                    indicator: indicators[round % indicators.length],
                    clearIndicators: round % 3 === 2,
                }
            );

            const point = await chartPoint(page, 0.4 + (round % 3) * 0.08, 0.45);
            await page.mouse.move(point.x, point.y);
            await page.mouse.wheel(0, round % 2 === 0 ? -120 : 120);
        }

        await page.evaluate(() => {
            window.__VIEWX_E2E__?.clearIndicators();
            window.__VIEWX_E2E__?.clearDrawings();
            window.__VIEWX_E2E__?.setChartSymbol('XAUUSDm', 'MT5');
            window.__VIEWX_E2E__?.setChartTimeframe('15');
            window.__VIEWX_E2E__?.addIndicator('RSI');
        });

        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getChartState())
        ).toMatchObject({ symbol: 'XAUUSDm', interval: '15', source: 'MT5' });
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getIndicatorState().configured.map((item) => item.type) ?? [])
        ).toEqual(['RSI']);
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().count ?? -1)
        ).toBe(0);

        await attachDiagnostics(page, testInfo);
    });
});


test.describe('mobile symbol carousel synchronization', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('external chart symbol selection is not reverted by a stale carousel center', async ({ page }) => {
        await page.goto('/en/chart', { waitUntil: 'domcontentloaded' });
        await expect.poll(async () =>
            page.evaluate(() => Boolean(window.__VIEWX_E2E__))
        ).toBe(true);
        await page.evaluate(() => window.__VIEWX_E2E__?.seed());

        const carousel = page.getByTestId('mobile-symbol-carousel');
        await expect(carousel).toBeVisible();

        // Simulate the market picker updating the active chart outside the carousel.
        await page.evaluate(() => window.__VIEWX_E2E__?.setChartSymbol('BTCUSDm', 'MT5'));
        await expect.poll(async () =>
            page.evaluate(() => window.__VIEWX_E2E__?.getChartState()?.symbol)
        ).toBe('BTCUSDm');

        const selectedBtc = carousel.locator('[data-symbol="BTCUSDm"]').first().locator('.rounded-full').first();
        await expect(selectedBtc).toHaveClass(/bg-primary\/20/);

        // The old carousel had a ~220ms delayed write that restored the old symbol.
        await page.waitForTimeout(500);
        expect(await page.evaluate(() => window.__VIEWX_E2E__?.getChartState()?.symbol)).toBe('BTCUSDm');

        // A second picker change must also remain authoritative after recentering.
        await page.evaluate(() => window.__VIEWX_E2E__?.setChartSymbol('EURUSDm', 'MT5'));
        const selectedEur = carousel.locator('[data-symbol="EURUSDm"]').first().locator('.rounded-full').first();
        await expect(selectedEur).toHaveClass(/bg-primary\/20/);
        await page.waitForTimeout(500);
        expect(await page.evaluate(() => window.__VIEWX_E2E__?.getChartState()?.symbol)).toBe('EURUSDm');
    });
});
