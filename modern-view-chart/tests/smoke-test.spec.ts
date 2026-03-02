import { test, expect } from '@playwright/test';

test('verify chart render', async ({ page }) => {
    test.setTimeout(30000);
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.error('Navigation error:', e));

    console.log('Waiting 10 seconds for chart to render and fetch data...');
    await page.waitForTimeout(10000);

    await page.screenshot({ path: 'chart_screenshot.png' });
    console.log('Saved screenshot to chart_screenshot.png');

    console.log('--- BROWSER CONSOLE LOGS ---');
    console.log(logs.join('\n'));
    console.log('------------------------------');

    const canvasCount = await page.locator('canvas').count();
    console.log(`Number of canvas elements found: ${canvasCount}`);

    expect(canvasCount).toBeGreaterThan(0);
});
