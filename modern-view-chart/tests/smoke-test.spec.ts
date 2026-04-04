import { test, expect } from '@playwright/test';

test('verify chart render', async ({ page }) => {
    test.setTimeout(30000);
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

    console.log('Navigating to /en/chart');
    await page.goto('/en/chart', { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.error('Navigation error:', e));

    console.log('Waiting for chart canvas...');
    await page.waitForSelector('canvas', { timeout: 30000 }).catch(async () => {
        await page.waitForTimeout(5000);
    });

    await page.screenshot({ path: 'chart_screenshot.png' });
    console.log('Saved screenshot to chart_screenshot.png');

    console.log('--- BROWSER CONSOLE LOGS ---');
    console.log(logs.join('\n'));
    console.log('------------------------------');

    const canvasCount = await page.locator('canvas').count();
    console.log(`Number of canvas elements found: ${canvasCount}`);

    expect(canvasCount).toBeGreaterThan(0);
});
