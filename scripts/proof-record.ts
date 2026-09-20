import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, type ChildProcess, execSync } from 'child_process';

const outputDir = path.resolve(process.cwd(), 'media', 'proof');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`[Proof-Record] Output directory: ${outputDir}`);
  const baseUrl = 'http://localhost:3000';
  let devProcess: ChildProcess | null = null;

  if (!(await isServerUp(baseUrl))) {
    console.log('[Proof-Record] Server not responding on http://localhost:3000. Launching `npm run dev`...');
    devProcess = spawn('npm', ['run', 'dev'], {
      shell: true,
      stdio: 'pipe',
    });

    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isServerUp(baseUrl)) {
        console.log('[Proof-Record] Dev server is up!');
        break;
      }
      attempts++;
    }

    if (!(await isServerUp(baseUrl))) {
      console.error('[Proof-Record] Dev server failed to respond within 30 seconds.');
      if (devProcess) devProcess.kill();
      process.exit(1);
    }
  } else {
    console.log('[Proof-Record] Server is already running on http://localhost:3000.');
  }

  console.log('[Proof-Record] Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  const video = page.video();

  try {
    console.log('[Proof-Record] Step 1: Navigating to Home (http://localhost:3000)...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Smooth scroll down
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    console.log('[Proof-Record] Step 2: Navigating to Simulator (/simulator)...');
    await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: -200, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    console.log('[Proof-Record] Step 3: Navigating to Receipt (/receipt/4412)...');
    await page.goto(`${baseUrl}/receipt/4412`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    console.log('[Proof-Record] Navigation sequence complete (~21s). Closing context to finalize video...');
  } finally {
    await page.close();
    await context.close();
    await browser.close();

    if (devProcess) {
      devProcess.kill();
    }
  }

  if (video) {
    const videoPath = await video.path();
    const stats = fs.statSync(videoPath);
    console.log(`\n========================================`);
    console.log(`PROOF RECORDING SAVED SUCCESSFULLY:`);
    console.log(`Path: ${videoPath}`);
    console.log(`Size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Use ffprobe or ffmpeg to get exact duration
    try {
      const probeOutput = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, {
        encoding: 'utf-8',
      }).trim();
      console.log(`Duration: ${probeOutput} seconds`);
    } catch {
      try {
        const ffmpegOutput = execSync(`ffmpeg -i "${videoPath}" 2>&1`, { encoding: 'utf-8' });
        const match = ffmpegOutput.match(/Duration:\s*(\d+:\d+:\d+\.\d+)/);
        if (match) {
          console.log(`Duration: ${match[1]}`);
        }
      } catch (err: any) {
        if (err.stdout) {
          const match = err.stdout.match(/Duration:\s*(\d+:\d+:\d+\.\d+)/);
          if (match) console.log(`Duration: ${match[1]}`);
        }
      }
    }
    console.log(`========================================\n`);
  } else {
    console.error('[Proof-Record] No video object found on page context.');
  }
}

main().catch((err) => {
  console.error('[Proof-Record] Error during recording:', err);
  process.exit(1);
});
