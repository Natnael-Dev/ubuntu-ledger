import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function preview() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const deckHtmlPath = path.resolve('docs/hackathon/deck/index.html');
  await page.goto('file:///' + deckHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(500);

  const slides = await page.locator('.slide').all();
  console.log(`Found ${slides.length} slides.`);

  const previewDir = path.resolve('media/deck-preview');
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  for (let i = 0; i < slides.length; i++) {
    const box = await slides[i].boundingBox();
    console.log(`Slide ${i + 1}: ${box?.width} x ${box?.height}`);
    const slideNum = String(i + 1).padStart(2, '0');
    await slides[i].screenshot({ path: path.join(previewDir, `slide-${slideNum}.png`) });
  }

  await browser.close();
  console.log('✓ All 11 slide previews captured in media/deck-preview/');
}

preview().catch((err) => {
  console.error(err);
  process.exit(1);
});
