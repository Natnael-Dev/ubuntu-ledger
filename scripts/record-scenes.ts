import { chromium, type Browser, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:3000';
const CLIPS_DIR = path.resolve(process.cwd(), 'media', 'clips');

if (!fs.existsSync(CLIPS_DIR)) {
  fs.mkdirSync(CLIPS_DIR, { recursive: true });
}

async function moveRecordedVideo(tempDir: string, targetName: string): Promise<string> {
  const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.webm'));
  if (files.length === 0) {
    throw new Error(`No webm file recorded in ${tempDir}`);
  }
  const sourceFile = path.join(tempDir, files[0]);
  const targetFile = path.join(CLIPS_DIR, targetName);
  if (fs.existsSync(targetFile)) {
    fs.unlinkSync(targetFile);
  }
  fs.renameSync(sourceFile, targetFile);
  try {
    fs.rmdirSync(tempDir);
  } catch {}
  return targetFile;
}

function getDuration(filePath: string): string {
  try {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, {
      encoding: 'utf-8',
    }).trim();
    return `${parseFloat(out).toFixed(1)}s`;
  } catch {
    return 'unknown';
  }
}

async function smoothScroll(page: Page, yOffset: number, steps = 15, stepDelayMs = 40) {
  const delta = yOffset / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), delta);
    await page.waitForTimeout(stepDelayMs);
  }
}

// Helpers for USSD interaction
async function sendUssdKey(page: Page, key: string) {
  const prevCount = await page.locator('[data-direction="received"]').count();
  await page.getByTestId(`key-${key}`).click();
  await page.waitForFunction(
    (target) => document.querySelectorAll('[data-direction="received"]').length > target,
    prevCount,
    { timeout: 10000 }
  );
  await page.waitForTimeout(800);
}

async function sendUssdText(page: Page, text: string) {
  const prevCount = await page.locator('[data-direction="received"]').count();
  await page.getByTestId('text-input').fill(text);
  await page.getByTestId('text-input').press('Enter');
  await page.waitForFunction(
    (target) => document.querySelectorAll('[data-direction="received"]').length > target,
    prevCount,
    { timeout: 10000 }
  );
  await page.waitForTimeout(800);
}

async function main() {
  console.log('=== Ubuntu Ledger Demo Video Producer: Production Scene Recording ===');
  console.log(`Clips directory: ${CLIPS_DIR}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  try {
    // -------------------------------------------------------------------------
    // SCENE 01: HOME (~12s)
    // -------------------------------------------------------------------------
    console.log('[Scene 1/9] Recording scene-01-home.webm (~12s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-01');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('h1:has-text("Ward Proof-Line")');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Scroll smoothly down past hero to principle banner
      await smoothScroll(page, 450, 15, 40);
      await page.waitForTimeout(2000);

      // Scroll to Three Proofs That Power Public Trust
      await smoothScroll(page, 650, 20, 40);
      await page.waitForSelector('text=Three Proofs That Power Public Trust');
      await page.waitForTimeout(3500);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-01-home.webm');
      console.log(`✓ scene-01-home.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 02: RECEIPT (~22s)
    // -------------------------------------------------------------------------
    console.log('[Scene 2/9] Recording scene-02-receipt.webm (~22s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-02');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/receipt/4412`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="receipt-sha256"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Hold on receipt header & genesis SHA-256 hash
      await page.waitForTimeout(2000);

      // Smooth scroll through receipt summary & source document
      await smoothScroll(page, 320, 16, 40);
      await page.waitForSelector('text=CHECKED');
      await page.waitForTimeout(2500);

      // Scroll to Plain Language Summary (AI)
      await smoothScroll(page, 280, 15, 40);
      const aiSummary = page.locator('summary:has-text("Plain Language Summary (AI)")');
      if (await aiSummary.isVisible()) {
        await aiSummary.click();
        await page.waitForTimeout(1500);
        await smoothScroll(page, 220, 12, 40);
        await page.waitForTimeout(3500);
      } else {
        await page.waitForTimeout(4000);
      }

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-02-receipt.webm');
      console.log(`✓ scene-02-receipt.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 03: SIMULATOR AMINA (~25s)
    // -------------------------------------------------------------------------
    console.log('[Scene 3/9] Recording scene-03-simulator-amina.webm (~25s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-03');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/simulator`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="feature-phone"]');
      await page.waitForSelector('[data-testid="btn-dial"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Ensure Amina is active
      const aminaBtn = page.getByRole('button', { name: /Amina/i });
      await aminaBtn.click();
      await page.waitForTimeout(800);

      // Dial *890#
      console.log('  Dialing *890# as Amina...');
      await page.getByTestId('btn-dial').click();
      await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });
      await page.waitForTimeout(1200);

      // Select Check Project (1)
      console.log('  Selecting option 1...');
      await sendUssdKey(page, '1');

      // Enter Project Code 4412
      console.log('  Entering project code 4412...');
      await sendUssdText(page, '4412');

      // Check this project (1)
      console.log('  Confirming project 4412...');
      await sendUssdKey(page, '1');

      // Answer Q1 (Yes)
      console.log('  Answering Q1 Yes (1)...');
      await sendUssdKey(page, '1');

      // Answer Q2 (Yes)
      console.log('  Answering Q2 Yes (1)...');
      await sendUssdKey(page, '1');

      // Answer Q3 (Yes)
      console.log('  Answering Q3 Yes (1)...');
      await sendUssdKey(page, '1');

      // Verify quorum 2->3 transition on LCD
      await page.waitForFunction(
        () => {
          const raw = document.querySelector('[data-testid="raw-response"]')?.textContent || '';
          return raw.includes('3 of 3') || raw.includes('3 of 3 neighbours');
        },
        { timeout: 10000 }
      );
      console.log('  Amina observation submitted. Quorum reached 3 of 3!');
      await page.waitForTimeout(4000);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-03-simulator-amina.webm');
      console.log(`✓ scene-03-simulator-amina.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 04: SIMULATOR GIRMA (~21s)
    // -------------------------------------------------------------------------
    console.log('[Scene 4/9] Recording scene-04-simulator-girma.webm (~21s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-04');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/simulator`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="feature-phone"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Select Girma (Colliding Neighbor, same cell cluster)
      const girmaBtn = page.getByRole('button', { name: /Girma/i });
      await girmaBtn.click();
      await page.waitForSelector('text=DUPLICATE CLUSTER');
      await page.waitForTimeout(1000);

      // Dial *890#
      console.log('  Dialing *890# as Girma...');
      await page.getByTestId('btn-dial').click();
      await page.waitForFunction(
        () => {
          const lines = Array.from(document.querySelectorAll('[data-direction="received"]'));
          return lines.length > 0 && lines[lines.length - 1].textContent?.includes('CON');
        },
        { timeout: 10000 }
      );
      await page.waitForTimeout(800);

      // Select Check Project (1)
      await sendUssdKey(page, '1');

      // Enter Project Code 4412
      await sendUssdText(page, '4412');

      // Confirm (1)
      await sendUssdKey(page, '1');

      // Q1 Yes (1)
      await sendUssdKey(page, '1');
      // Q2 Yes (1)
      await sendUssdKey(page, '1');
      // Q3 Yes (1)
      await sendUssdKey(page, '1');

      // Verify duplicate suppression on LCD: "This area has already been counted, so the total stays at 3."
      await page.waitForFunction(
        () => {
          const raw = document.querySelector('[data-testid="raw-response"]')?.textContent || '';
          return raw.includes('already been counted') || raw.includes('stays at 3');
        },
        { timeout: 10000 }
      );
      console.log('  Girma duplicate suppression confirmed: total stays at 3!');
      await page.waitForTimeout(4500);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-04-simulator-girma.webm');
      console.log(`✓ scene-04-simulator-girma.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 05: SIMULATOR KALINDA (~17s)
    // -------------------------------------------------------------------------
    console.log('[Scene 5/9] Recording scene-05-simulator-kalinda.webm (~17s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-05');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/simulator`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="feature-phone"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Select Kalinda (Independent Witness, Kebele 09)
      const kalindaBtn = page.getByRole('button', { name: /Kalinda/i });
      await kalindaBtn.click();
      await page.waitForTimeout(1000);

      // Dial as Kalinda
      console.log('  Dialing *890# as Kalinda...');
      await page.getByTestId('btn-dial').click();
      await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Navigate check project or fee verification
      await sendUssdKey(page, '1');
      await sendUssdText(page, '4412');
      await sendUssdKey(page, '1');

      // Hold on independent witness confirmation
      await page.waitForTimeout(3500);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-05-simulator-kalinda.webm');
      console.log(`✓ scene-05-simulator-kalinda.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 06: CONSOLE (~25s)
    // -------------------------------------------------------------------------
    console.log('[Scene 6/9] Recording scene-06-console.webm (~25s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-06');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/console`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="project-row-4412"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Reset demo state if available
      console.log('  Resetting demo state on project 4412...');
      const resetBtn = page.getByTestId('demo-reset-btn');
      if (await resetBtn.isVisible()) {
        await resetBtn.click();
        await page.waitForTimeout(1000);
      }

      // Click "Record Claim"
      const claimBtn = page.getByTestId('claim-btn-4412');
      if (await claimBtn.isVisible()) {
        await claimBtn.click();
        await page.waitForSelector('[data-testid="claim-repair-modal"]');
        await page.waitForTimeout(1000);
        // Submit claim
        await page.getByTestId('claim-submit-btn').click();
        await page.waitForTimeout(1500);
      }

      // Point out Amber badge (REPAIR_CLAIMED) and 7-day probation lock countdown
      await page.waitForSelector('[data-testid="countdown-probation"]');
      await page.waitForTimeout(2000);

      // Now click "Attempt Close" as Administrator
      console.log('  Attempting early close to trigger 409 E_PROBATION_LOCKED...');
      const closeBtn = page.getByTestId('attempt-close-btn-4412');
      await closeBtn.waitFor({ state: 'visible' });
      await closeBtn.click();

      // Modal appears: 409 E_PROBATION_LOCKED
      await page.waitForSelector('[data-testid="console-alert-banner"]');
      await page.waitForSelector('text=STATUTORY REFUSAL — PROBATION ACTIVE');
      console.log('  409 Modal captured!');

      // Hold modal visible with clear focus for evaluator
      await page.waitForTimeout(7000);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-06-console.webm');
      console.log(`✓ scene-06-console.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 07: DIVERGENCE (~21s)
    // -------------------------------------------------------------------------
    console.log('[Scene 7/9] Recording scene-07-divergence.webm (~21s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-07');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/services/ET-ID-REPLACE`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="divergence-card"]');
      await page.waitForSelector('[data-testid="statutory-ledger"]');
      await page.waitForSelector('[data-testid="community-ledger"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Hold on side-by-side comparison
      await page.waitForTimeout(2500);

      // Smooth scroll down to compare Statutory vs Community ledger columns
      await smoothScroll(page, 300, 15, 40);
      await page.waitForTimeout(2500);

      // Highlight the divergence alert banner and median fee
      await page.waitForSelector('[data-testid="alert-banner"]');
      await smoothScroll(page, 250, 15, 40);
      await page.waitForTimeout(2500);

      // Scroll to k-anonymity cluster breakdown and refusal script
      await smoothScroll(page, 350, 15, 40);
      await page.waitForSelector('text=Refusal Script');
      await page.waitForTimeout(3500);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-07-divergence.webm');
      console.log(`✓ scene-07-divergence.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 08: PWA (~21s)
    // -------------------------------------------------------------------------
    console.log('[Scene 8/9] Recording scene-08-pwa.webm (~21s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-08');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/pwa`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="sync-badge"]');
      await page.waitForSelector('[data-testid="airplane-mode-toggle"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // 1. Toggle Airplane Mode: ON
      console.log('  Turning Airplane Mode ON...');
      const airplaneBtn = page.getByTestId('airplane-mode-toggle');
      await airplaneBtn.click();
      await page.waitForSelector('text=Airplane Mode: ON');
      await page.waitForTimeout(1200);

      // 2. Submit observation offline
      console.log('  Submitting observation while offline...');
      await page.getByTestId('btn-submit-observation').click();
      await page.waitForSelector('[data-testid="submission-notice"]');
      await page.waitForSelector('text=QUEUED');
      await page.waitForTimeout(2500);

      // 3. Toggle Airplane Mode: OFF (Reconnect)
      console.log('  Turning Airplane Mode OFF (reconnecting)...');
      await airplaneBtn.click();
      await page.waitForSelector('text=Airplane Mode: OFF');
      await page.waitForTimeout(1000);

      // 4. Click Sync Now
      console.log('  Flushing outbox queue...');
      await page.getByTestId('btn-sync-now').click();
      await page.waitForSelector('text=SYNCED');
      await page.waitForSelector('text=(All synced)');
      console.log('  Outbox flushed and marked SYNCED!');
      await page.waitForTimeout(3500);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-08-pwa.webm');
      console.log(`✓ scene-08-pwa.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // SCENE 09: AI OVERSIGHT (~18s)
    // -------------------------------------------------------------------------
    console.log('[Scene 9/9] Recording scene-09-ai-oversight.webm (~18s)...');
    {
      const tempDir = path.join(CLIPS_DIR, 'tmp-scene-09');
      fs.mkdirSync(tempDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/console`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="toggle-ai-insights-btn"]');
      await page.waitForTimeout(500); // Settle before first recorded action

      // Expand AI Oversight Insights
      console.log('  Expanding AI Oversight Insights...');
      await page.getByTestId('toggle-ai-insights-btn').click();
      await page.waitForSelector('text=Sybil & Collusion Ring Auditor');
      await page.waitForSelector('text=Cross-Ward Contractor Patterns');
      await page.waitForTimeout(2000);

      // Smooth scroll through both panels
      await smoothScroll(page, 300, 15, 40);
      await page.waitForTimeout(2500);

      await smoothScroll(page, 200, 15, 40);
      await page.waitForTimeout(3500);

      await page.waitForTimeout(1000); // Trailing settle for clean trim
      await page.close();
      await context.close();
      const finalPath = await moveRecordedVideo(tempDir, 'scene-09-ai-oversight.webm');
      console.log(`✓ scene-09-ai-oversight.webm ready (${getDuration(finalPath)}, ${fs.statSync(finalPath).size} bytes)`);
    }

    console.log('\n======================================================');
    console.log('ALL 9 SCENES RECORDED AGAINST PRODUCTION BUILD');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[Record-Scenes] Fatal error:', err);
  process.exit(1);
});
