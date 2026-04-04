import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:13000';
const chromiumOnly = (process.env.PLAYWRIGHT_CHROMIUM_ONLY || '1') === '1';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL,
        trace: 'on-first-retry',
        viewport: { width: 1280, height: 720 },
    },
    projects: chromiumOnly
        ? [
            {
                name: 'chromium',
                use: { ...devices['Desktop Chrome'] },
            },
        ]
        : [
            {
                name: 'chromium',
                use: { ...devices['Desktop Chrome'] },
            },
            {
                name: 'firefox',
                use: { ...devices['Desktop Firefox'] },
            },
            {
                name: 'webkit',
                use: { ...devices['Desktop Safari'] },
            },
            {
                name: 'Mobile Chrome',
                use: { ...devices['Pixel 5'] },
            },
            {
                name: 'Mobile Safari',
                use: { ...devices['iPhone 12'] },
            },
        ],
});
