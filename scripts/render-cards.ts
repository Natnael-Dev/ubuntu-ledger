import { chromium } from '@playwright/test';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  const introPath = path.resolve(process.cwd(), 'media', 'intro.html');
  const outroPath = path.resolve(process.cwd(), 'media', 'outro.html');

  const introPng = path.resolve(process.cwd(), 'media', 'intro.png');
  const outroPng = path.resolve(process.cwd(), 'media', 'outro.png');

  console.log(`Rendering intro card from ${introPath}...`);
  await page.goto(`file://${introPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: introPng, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`✓ Saved ${introPng}`);

  console.log(`Rendering outro card from ${outroPath}...`);
  await page.goto(`file://${outroPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outroPng, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`✓ Saved ${outroPng}`);

  await browser.close();
}

main().catch((err) => {
  console.error('Error rendering cards:', err);
  process.exit(1);
});
