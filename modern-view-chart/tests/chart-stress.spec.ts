import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
    installChartPerfProbe,
    readBrowserErrors,
    readChartPerfSnapshot,
} from './helpers/chart-performance';

async function attachDiagnostics(page: Page, testInfo: TestInfo) {
    const metrics = await readChartPerfSnapshot(page);
    const errors = readBrowserErrors(page);

    await testInfo.attach('performance-metrics.json', {
        body: Buffer.from(JSON.stringify(metrics, null, 2)),
        contentType: 'application/json',
    });
    await testInfo.attach('browser-errors.json', {
        body: Buffer.from(JSON.stringify(errors, null, 2)),
        contentType: 'application/json',
    });

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
    expect(metrics.canvasCount).toBeGreaterThan(0);
    expect(metrics.longTasks.filter((duration) => duration > 1000)).toHaveLength(0);
}

async function chartPoint(page: Page, xRatio: number, yRatio: number) {
    const canvases = page.getByTestId('chart-price-e2e-chart').locator('canvas');
    const box = await canvases.evaluateAll((elements) => {
        const visible = elements
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    area: rect.width * rect.height,
                };
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .sort((a, b) => b.area - a.area);
        return visible[0] ?? null;
    });
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) throw new Error('Visible chart canvas is unavailable');

    // Lightweight Charts adds extra canvases for price scales and primitives.
    // Their DOM order changes as drawings are attached, so canvas.first() is
    // not a stable interaction target. Use the largest visible plot canvas.
    const left = Math.max(0, box.x) + 8;
    const right = Math.min(viewport.width, box.x + box.width) - 8;
    const top = Math.max(0, box.y) + 8;
    const bottom = Math.min(viewport.height, box.y + box.height) - 8;
    if (right <= left || bottom <= top) throw new Error('Chart canvas is outside the viewport');

    return {
        x: left + (right - left) * xRatio,
        y: top + (bottom - top) * yRatio,
    };
}

async function drawTwoPointTool(page: Page, tool: 'trend-line' | 'rectangle' | 'fib-retracement') {
    await page.evaluate((drawingTool) => window.__VIEWX_E2E__?.startDrawing(drawingTool), tool);
    const first = await chartPoint(page, 0.35, 0.35);
    const second = await chartPoint(page, 0.65, 0.62);

    await page.mouse.move(first.x, first.y);
    await page.waitForTimeout(24);
    await page.mouse.click(first.x, first.y);
    await expect.poll(async () =>
        page.evaluate(() => window.__VIEWX_E2E__?.getDrawingState().tempPoints ?? -1)
    ).toBe(1);

    await page.mouse.move(second.x, second.y);
    await page.waitForTimeout(24);
    await page.mouse.click(second.x, second.y);
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

        await page.evaluate(() => window.__VIEWX_E2E__?.burstTicks(500));
        await page.mouse.move(center.x + 40, center.y + 20);
        await page.mouse.move(center.x - 80, center.y - 25, { steps: 30 });

        await expect(page.getByTestId('chart-container-e2e-chart')).toHaveAttribute('data-symbol', 'XAUUSDm');
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
