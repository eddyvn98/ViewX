import { expect, test } from '@playwright/test';

const baseURL = process.env.VIEWX_LIVE_BASE_URL || 'https://vivutrade.io.vn';
test.use({ baseURL });

test.describe('live production chart (no fixtures or cache)', () => {
  test('clean browser loads actual candles and RSI within budget', async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    const started = Date.now();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const websocketUrls: string[] = [];
    const websocketErrors: string[] = [];
    let candlesReadyMs: number | null = null;
    let indicatorReadyMs: number | null = null;

    // Playwright creates a fresh isolated browser context for each repeat.
    // This file is run against the real public origin, never a local E2E mock.
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon/i.test(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || 'unknown'}`);
    });
    page.on('websocket', (socket) => {
      websocketUrls.push(socket.url());
      socket.on('socketerror', (error) => websocketErrors.push(String(error)));
    });

    try {
      const response = await page.goto('/en/chart', {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      expect(response?.status()).toBe(200);
      const chart = page.locator('[data-testid^="chart-container-"]').first();
      await expect(chart).toBeVisible();

      // SLA is counted from navigation start, not from DOM-ready.
      const remainingMs = Math.max(1, 5_000 - (Date.now() - started));
      await expect.poll(async () => Number(await chart.getAttribute('data-candle-count') || 0), {
        timeout: remainingMs,
        intervals: [100, 200, 300, 500],
      }).toBeGreaterThanOrEqual(150);
      candlesReadyMs = Date.now() - started;
      expect(candlesReadyMs).toBeLessThanOrEqual(5_000);

      await expect.poll(async () => Number(await chart.getAttribute('data-indicator-runtime-count') || 0), {
        timeout: 10_000,
      }).toBeGreaterThanOrEqual(1);
      indicatorReadyMs = Date.now() - started;
      await expect.poll(async () => page.locator('canvas').count(), {
        timeout: 5_000,
      }).toBeGreaterThan(0);

      await expect.poll(() => websocketUrls.some((url) => {
        try {
          const actual = new URL(url);
          const expected = new URL(baseURL);
          return actual.host === expected.host && actual.pathname === '/ws';
        } catch { return false; }
      }), { timeout: 10_000 }).toBe(true);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(websocketErrors).toEqual([]);
      expect(failedRequests.filter((entry) =>
        /ERR_NAME_NOT_RESOLVED|api\.vivutrade\.io\.vn/i.test(entry)
      )).toEqual([]);
    } finally {
      const evidence = {
        timestamp: new Date().toISOString(),
        target: baseURL,
        project: testInfo.project.name,
        repeatEachIndex: testInfo.repeatEachIndex,
        candlesReadyMs,
        indicatorReadyMs,
        consoleErrors,
        pageErrors,
        failedRequests,
        websocketUrls,
        websocketErrors,
      };
      await testInfo.attach('live-production-evidence.json', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      });
      try {
        await testInfo.attach('live-production-chart.png', {
          body: await page.screenshot({ fullPage: true, timeout: 10_000 }),
          contentType: 'image/png',
        });
      } catch (error) {
        console.warn('Production screenshot unavailable:', String(error));
      }
    }
  });
});
