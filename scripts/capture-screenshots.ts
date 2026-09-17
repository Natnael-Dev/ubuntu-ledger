import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';

const targetMode = process.argv[2] || 'baseline';
const outputDir = path.resolve(process.cwd(), 'docs', 'design', 'screenshots', targetMode);

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

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`[Screenshots] Capturing ${targetMode} screenshots to: ${outputDir}`);

  let devProcess: ChildProcess | null = null;
  const baseUrl = 'http://localhost:3000';

  if (!(await isServerUp(baseUrl))) {
    console.log('[Screenshots] Server not detected on http://localhost:3000. Launching `npx next start -p 3000`...');
    devProcess = spawn('npx', ['next', 'start', '-p', '3000'], {
      shell: true,
      stdio: 'pipe',
    });

    devProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[server] ${d.toString()}`));
    devProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[server-err] ${d.toString()}`));

    // Wait for server to respond
    let attempts = 0;
    while (attempts < 45) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isServerUp(baseUrl)) {
        console.log('[Screenshots] Server is up!');
        break;
      }
      attempts++;
    }

    if (!(await isServerUp(baseUrl))) {
      console.error('[Screenshots] Failed to start server within 30s. Exiting.');
      if (devProcess) devProcess.kill();
      process.exit(1);
    }
  } else {
    console.log('[Screenshots] Server already active on http://localhost:3000.');
  }

  const browser = await chromium.launch();
  const results: string[] = [];

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        const fullUrl = `${baseUrl}${route.path}`;
        try {
          await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
        } catch {
          await page.goto(fullUrl, { waitUntil: 'load', timeout: 15000 });
        }
        await page.waitForTimeout(500); // Allow fonts & hydration to stabilize

        const filename = `${route.name}_${vp.name}.png`;
        const filePath = path.join(outputDir, filename);

        await page.screenshot({ path: filePath, fullPage: true });
        results.push(filePath);
        console.log(`✓ Saved: ${filename}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
    if (devProcess) {
      console.log('[Screenshots] Terminating spawned server...');
      devProcess.kill();
    }
  }

  console.log(`[Screenshots] Completed! Captured ${results.length} screenshots.`);
}

main().catch((err) => {
  console.error('[Screenshots] Fatal error:', err);
  process.exit(1);
});
