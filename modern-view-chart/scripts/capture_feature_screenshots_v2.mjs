import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const featuresDir = path.resolve('public/images/features');
if (!fs.existsSync(featuresDir)) fs.mkdirSync(featuresDir, { recursive: true });

// Cấu hình (Config) cho từng tính năng: URL, selector ưu tiên, hoặc vùng clip mặc định
const SCREENSHOT_CONFIGS = [
  // --- PAGE: CHART ---
  { url: '/vi/chart', filename: 'multi_chart_preview.png', selector: 'main', clip: { x: 0, y: 0, width: 1920, height: 1080 } },
  { url: '/vi/chart', filename: 'smart_overlay_preview.png', selector: '.chart-container, mainCanvas', clip: { x: 200, y: 100, width: 1200, height: 800 } },
  { url: '/vi/chart', filename: 'unlimited_alerts_preview.png', selector: '.alerts-panel, [data-testid="alerts"]', clip: { x: 1500, y: 50, width: 400, height: 800 } },
  { url: '/vi/chart', filename: 'unlimited_indicators_preview.png', selector: '.indicators-list', clip: { x: 50, y: 50, width: 400, height: 600 } },
  { url: '/vi/chart', filename: 'symbol_sync_preview.png', selector: '.symbol-search, header', clip: { x: 0, y: 0, width: 800, height: 300 } },
  { url: '/vi/chart', filename: 'fast_workflow_preview.png', selector: '.trade-panel, [data-testid="order-panel"]', clip: { x: 1500, y: 200, width: 400, height: 600 } },
  { url: '/vi/chart', filename: 'mt5_extension_preview.png', selector: '.mt5-status', clip: { x: 1600, y: 0, width: 300, height: 200 } },
  { url: '/vi/chart', filename: 'modern_trading_preview.png', selector: 'main', clip: { x: 0, y: 0, width: 1920, height: 1080 } },

  // --- PAGE: DASHBOARD ---
  { url: '/vi/strategy/dashboard', filename: 'performance_dashboard_preview.png', selector: '.max-w-7xl, main', clip: { x: 0, y: 0, width: 1920, height: 1080 } },
  { url: '/vi/strategy/dashboard', filename: 'ai_performance_preview.png', selector: 'section, [data-testid="ai-performance"]', clip: { x: 0, y: 300, width: 1920, height: 780 } },

  // --- PAGE: MATRIX / SIGNALS ---
  { url: '/vi/signals', filename: 'signal_matrix_preview.png', selector: '#signal-monitor-matrix, table', clip: { x: 0, y: 100, width: 1920, height: 900 } },
  { url: '/vi/signals', filename: 'strategy_builder_preview.png', selector: '#signal-monitor-matrix', clip: { x: 0, y: 0, width: 1920, height: 1080 } },
  { url: '/vi/signals', filename: 'power_user_preview.png', selector: 'main', clip: { x: 0, y: 0, width: 1920, height: 1080 } },
  { url: '/vi/signals', filename: 'pro_plus_all_preview.png', selector: 'main', clip: { x: 0, y: 0, width: 1920, height: 1080 } },
  { url: '/vi/signals', filename: 'ai_optimization_preview.png', selector: 'main', clip: { x: 0, y: 0, width: 1920, height: 1080 } },
];

(async () => {
  console.log('Khởi tạo trình duyệt Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Nhóm config theo URL để tối ưu thời gian load trang
  const groupedConfigs = SCREENSHOT_CONFIGS.reduce((acc, config) => {
    acc[config.url] = acc[config.url] || [];
    acc[config.url].push(config);
    return acc;
  }, {});

  for (const [url, configs] of Object.entries(groupedConfigs)) {
    console.log(`\nĐang truy cập: http://localhost:3000${url}`);
    await page.goto(`http://localhost:3000${url}`, { waitUntil: 'load' }).catch(() => {});
    await page.waitForTimeout(6000); // Chờ cho trang render (API, charts, etc.)
    
    for (const config of configs) {
      const outputPath = path.join(featuresDir, config.filename);
      console.log(` \u2192 Chụp ảnh: ${config.filename}`);
      
      try {
        let captured = false;
        
        // 1. Thử crop theo selector nếu có
        if (config.selector) {
          const element = page.locator(config.selector).first();
          if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
            await element.screenshot({ path: outputPath });
            console.log(`   [OK] Đã crop bằng selector: "${config.selector}"`);
            captured = true;
          }
        }
        
        // 2. Nếu selector không hoạt động, dùng vùng clip mặc định
        if (!captured && config.clip) {
          await page.screenshot({ path: outputPath, clip: config.clip });
          console.log(`   [OK] Đã crop bằng tọa độ clip (x:${config.clip.x}, y:${config.clip.y}, w:${config.clip.width}, h:${config.clip.height})`);
          captured = true;
        }
        
        // 3. Fallback cuối cùng: chụp toàn màn hình
        if (!captured) {
          await page.screenshot({ path: outputPath });
          console.log(`   [OK] Đã chụp toàn màn hình (Fallback)`);
        }
        
      } catch (error) {
        console.error(`   [LỖI] Không thể chụp ${config.filename}:`, error.message);
      }
    }
  }

  await browser.close();
  console.log('\nHoàn tất việc chụp và crop ảnh!');
})();
