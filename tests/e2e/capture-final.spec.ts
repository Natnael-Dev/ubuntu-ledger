import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const outputDir = path.resolve(process.cwd(), 'docs', 'design', 'screenshots', 'final');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-412x915', width: 412, height: 915 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'simulator', path: '/simulator' },
  { name: 'console', path: '/console' },
  { name: 'receipt-4412', path: '/receipt/4412' },
  { name: 'services-divergence', path: '/services/ET-ID-REPLACE' },
  { name: 'pwa', path: '/pwa' },
];

test.describe('Visual QA - Final Screenshot Capture', () => {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`capture ${route.name} at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        const filename = `${route.name}_${vp.name}.png`;
        const filePath = path.join(outputDir, filename);

        await page.screenshot({ path: filePath, fullPage: true });
      });
    }
  }
});
