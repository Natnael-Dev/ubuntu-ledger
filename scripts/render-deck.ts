import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('Launching browser for pitch deck PDF rendering...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  const deckHtmlPath = path.resolve(process.cwd(), 'docs', 'hackathon', 'deck', 'index.html');
  const outputPath = path.resolve(process.cwd(), 'media', 'ubuntu-ledger-pitch.pdf');

  // Ensure output directory exists
  const mediaDir = path.dirname(outputPath);
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // Windows file URI formatting
  const fileUrl = 'file:///' + deckHtmlPath.replace(/\\/g, '/');
  console.log(`Loading deck from ${fileUrl}...`);

  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for Google Fonts to be fully loaded
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(1000);

  console.log(`Generating PDF at ${outputPath}...`);
  await page.pdf({
    path: outputPath,
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    width: '1920px',
    height: '1080px',
    margin: {
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
    },
  });

  await browser.close();

  const stats = fs.statSync(outputPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✓ Pitch deck PDF successfully generated: ${outputPath}`);
  console.log(`  File size: ${sizeMb} MB (Limit: ≤100MB)`);
}

main().catch((err) => {
  console.error('Error generating pitch deck PDF:', err);
  process.exit(1);
});
