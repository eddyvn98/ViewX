import { expect, test } from '@playwright/test';

test.describe('chart PageSpeed quality regressions', () => {
    test('metadata, headers, agent discovery and controls remain hardened', async ({ page }) => {
        test.setTimeout(30_000);

        const response = await page.goto('/en/chart', { waitUntil: 'domcontentloaded' });
        expect(response?.ok()).toBe(true);

        const chart = page.locator('[data-testid^="chart-container-"]').first();
        await expect(chart).toBeVisible();
        await expect.poll(async () => Number(await chart.getAttribute('data-candle-count') || 0), {
            timeout: 10_000,
        }).toBeGreaterThanOrEqual(150);

        const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewport || '').not.toMatch(/maximum-scale\s*=\s*1/i);
        expect(viewport || '').not.toMatch(/user-scalable\s*=\s*no/i);

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical || '').toMatch(/\/en\/chart\/?$/);

        const initialGoogleGsiScripts = await page.locator('script[src*="accounts.google.com/gsi/client"]').count();
        expect(initialGoogleGsiScripts).toBe(0);

        const unnamedVisibleButtons = await page.locator('button').evaluateAll((buttons) =>
            buttons
                .filter((button) => {
                    const element = button as HTMLElement;
                    if (element.getClientRects().length === 0) return false;
                    const text = (element.textContent || '').trim();
                    const ariaLabel = (element.getAttribute('aria-label') || '').trim();
                    const ariaLabelledBy = (element.getAttribute('aria-labelledby') || '').trim();
                    const title = (element.getAttribute('title') || '').trim();
                    return !text && !ariaLabel && !ariaLabelledBy && !title;
                })
                .slice(0, 10)
                .map((button) => button.outerHTML.slice(0, 300)),
        );
        expect(unnamedVisibleButtons).toEqual([]);

        const pageHeaders = response?.headers() || {};
        expect(pageHeaders['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
        expect(pageHeaders['strict-transport-security'] || '').toContain('max-age=31536000');

        const llmsResponse = await page.request.get('/llms.txt');
        expect(llmsResponse.ok()).toBe(true);
        const llmsText = await llmsResponse.text();
        expect(llmsText).toContain('https://vivutrade.io.vn/en/chart');
        expect(llmsText).toContain('https://vivutrade.io.vn/vi/chart');
    });
});
