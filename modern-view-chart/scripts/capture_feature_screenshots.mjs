import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const featuresDir = path.resolve('public/images/features');
if (!fs.existsSync(featuresDir)) {
  fs.mkdirSync(featuresDir, { recursive: true });
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  console.log('Navigating to chart ...');
  await page.goto('http://localhost:3000/vi/chart', { waitUntil: 'load' }).catch(e => console.log(e));
  await page.waitForTimeout(8000); // give time for chart to render fully
  
  // Free Features
  console.log('Capturing Free plan features...');
  await page.screenshot({ path: path.join(featuresDir, 'multi_chart_preview.png') }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'unlimited_indicators_preview.png'), clip: { x: 100, y: 0, width: 800, height: 400 } }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'unlimited_alerts_preview.png'), clip: { x: 1520, y: 100, width: 400, height: 600 } }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'smart_overlay_preview.png'), clip: { x: 400, y: 300, width: 1000, height: 600 } }).catch(e=>console.log(e));

  // Dashboard features
  console.log('Navigating to dashboard ...');
  await page.goto('http://localhost:3000/vi/dashboard', { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(featuresDir, 'performance_dashboard_preview.png') }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'ai_performance_preview.png'), clip: { x: 100, y: 100, width: 1000, height: 700 } }).catch(e=>console.log(e));

  // Matrix/Algo features
  console.log('Navigating to matrix ...');
  await page.goto('http://localhost:3000/vi/matrix', { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(featuresDir, 'signal_matrix_preview.png') }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'strategy_builder_preview.png'), clip: { x: 300, y: 200, width: 1200, height: 800 } }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'power_user_preview.png') }).catch(e=>console.log(e));

  // Pro features => Back to chart
  console.log('Capturing Pro plan features...');
  await page.goto('http://localhost:3000/vi/chart', { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(featuresDir, 'symbol_sync_preview.png'), clip: { x: 0, y: 50, width: 350, height: 900 } }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'fast_workflow_preview.png'), clip: { x: 600, y: 200, width: 800, height: 600 } }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'mt5_extension_preview.png'), clip: { x: 0, y: 700, width: 1920, height: 380 } }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'modern_trading_preview.png') }).catch(e=>console.log(e));

  // Pro Plus
  console.log('Capturing Pro Plus features...');
  await page.screenshot({ path: path.join(featuresDir, 'pro_plus_all_preview.png') }).catch(e=>console.log(e));
  await page.screenshot({ path: path.join(featuresDir, 'ai_optimization_preview.png'), clip: { x: 700, y: 150, width: 900, height: 700 } }).catch(e=>console.log(e));

  await browser.close();
  console.log('Finished capturing all realistic UI screenshots!');
})();
