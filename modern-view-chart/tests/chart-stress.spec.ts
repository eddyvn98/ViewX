import { test, expect } from '@playwright/test';
import { installChartPerfProbe, readChartPerfSnapshot } from './helpers/chart-performance';

test.describe('chart interaction stability', () => {
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

        const metrics = await readChartPerfSnapshot(page);
        await testInfo.attach('performance-metrics.json', {
            body: Buffer.from(JSON.stringify(metrics, null, 2)),
            contentType: 'application/json',
        });

        expect(metrics.canvasCount).toBeGreaterThan(0);
        expect(metrics.longTasks.filter((duration) => duration > 1000)).toHaveLength(0);
    });

    test('rapid symbol and timeframe churn preserves final context', async ({ page }, testInfo) => {
        const symbols = ['BTCUSDm', 'EURUSDm', 'XAUUSDm'];
        const intervals = ['1', '15', '60', '5'];

        for (let round = 0; round < 12; round += 1) {
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

        const metrics = await readChartPerfSnapshot(page);
        await testInfo.attach('performance-metrics.json', {
            body: Buffer.from(JSON.stringify(metrics, null, 2)),
            contentType: 'application/json',
        });

        expect(metrics.longTasks.filter((duration) => duration > 1000)).toHaveLength(0);
    });

    test('pan zoom pointer and tick burst keep chart responsive', async ({ page }, testInfo) => {
        const chart = page.getByTestId('chart-price-e2e-chart');
        const box = await chart.boundingBox();
        expect(box).not.toBeNull();
        if (!box) return;

        const x = box.x + box.width * 0.55;
        const y = box.y + box.height * 0.45;

        await page.mouse.move(x, y);
        for (let i = 0; i < 12; i += 1) {
            await page.mouse.wheel(0, i % 2 === 0 ? -240 : 180);
        }

        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = 0; i < 30; i += 1) {
            await page.mouse.move(x + (i % 2 === 0 ? 150 : -150), y + Math.sin(i) * 20, { steps: 1 });
        }
        await page.mouse.up();

        await page.evaluate(() => window.__VIEWX_E2E__?.burstTicks(500));
        await page.mouse.move(x + 40, y + 20);
        await page.mouse.move(x - 80, y - 25, { steps: 20 });

        await expect(page.getByTestId('chart-container-e2e-chart')).toHaveAttribute('data-symbol', 'XAUUSDm');

        const metrics = await readChartPerfSnapshot(page);
        await testInfo.attach('performance-metrics.json', {
            body: Buffer.from(JSON.stringify(metrics, null, 2)),
            contentType: 'application/json',
        });

        expect(metrics.canvasCount).toBeGreaterThan(0);
        expect(metrics.longTasks.filter((duration) => duration > 1000)).toHaveLength(0);
    });
});
