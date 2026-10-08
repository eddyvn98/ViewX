import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page) {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    return { consoleErrors, pageErrors };
}

test.describe('production chart bootstrap without fixtures', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
                indexedDB.deleteDatabase('vivutrade-chart-cache');
            } catch {
                // Best effort clean-browser setup.
            }
        });
    });

    test('clean browser renders historical candles and indicator runtime', async ({ page }, testInfo) => {
        test.setTimeout(30_000);
        const errors = collectErrors(page);

        await page.goto('/en/chart', { waitUntil: 'domcontentloaded' });

        const chart = page.locator('[data-testid^="chart-container-"]').first();
        await expect(chart).toBeVisible();

        await expect.poll(async () => {
            const value = await chart.getAttribute('data-candle-count');
            return Number(value || 0);
        }, { timeout: 10_000 }).toBeGreaterThanOrEqual(150);

        await expect.poll(async () => {
            const value = await chart.getAttribute('data-indicator-runtime-count');
            return Number(value || 0);
        }, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

        await expect.poll(async () => page.locator('canvas').count(), { timeout: 10_000 }).toBeGreaterThan(0);

        await testInfo.attach('chart-production-bootstrap.png', {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
        });

        const ignoredConsolePatterns = [
            /favicon/i,
        ];
        const relevantConsoleErrors = errors.consoleErrors.filter(
            (message) => !ignoredConsolePatterns.some((pattern) => pattern.test(message)),
        );

        expect(errors.pageErrors).toEqual([]);
        expect(relevantConsoleErrors).toEqual([]);
    });
});
