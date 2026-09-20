// Feature-Phone Simulator — E2E Tests
// Authoritative sources: docs/specs/11-tasks.md T-17 acceptance criteria
//                        docs/specs/12-demo-script.md §5 (Checkpoint 2)
//
// Test strategy:
//  - Static UI tests (no network): verify simulator renders correctly
//  - Real API integration test: verify POST /api/ussd is invoked (not fake)
//  - Persona selection tests
//  - Duplicate/same-cluster interaction test
//  - Adversarial input handling

import { test, expect } from '@playwright/test';

// Serial mode: USSD simulator tests mutate in-memory session and project state.
test.describe.configure({ mode: 'serial' });

// ─── UI Rendering ─────────────────────────────────────────────────────────────

test.describe('simulator page loads and renders', () => {
  test('/simulator loads with feature-phone UI', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page).toHaveTitle(/Feature-Phone Simulator/);
  });

  test('feature phone frame is visible', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page.getByTestId('feature-phone')).toBeVisible();
  });

  test('LCD display is rendered with 4 line slots', async ({ page }) => {
    await page.goto('/simulator');
    const lcd = page.getByTestId('lcd-display');
    await expect(lcd).toBeVisible();

    // All 4 LCD line slots must exist in the DOM
    for (let i = 0; i < 4; i++) {
      await expect(page.getByTestId(`lcd-line-${i}`)).toBeAttached();
    }
  });

  test('keypad is visible with digit buttons', async ({ page }) => {
    await page.goto('/simulator');
    const keypad = page.getByTestId('keypad');
    await expect(keypad).toBeVisible();

    // Spot check a few keys
    for (const key of ['1', '2', '3', '0']) {
      await expect(page.getByTestId(`key-${key}`)).toBeVisible();
    }
  });

  test('DIAL button is present', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page.getByTestId('btn-dial')).toBeVisible();
  });

  test('transcript panel is visible', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page.getByTestId('transcript-panel')).toBeVisible();
  });

  test('persona selector shows canonical demo personas', async ({ page }) => {
    await page.goto('/simulator');
    // Amina (primary witness) and Girma (colliding neighbor) must be present
    await expect(page.getByText('Amina (Cluster Gamma - Demo Phone 1)').first()).toBeVisible();
    await expect(page.getByText('Girma (Cluster Gamma - Second Phone, Same Area)').first()).toBeVisible();
  });

  test('DEMO WITNESS badge shown for Amina', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page.getByText('DEMO WITNESS').first()).toBeVisible();
  });

  test('DUPLICATE CLUSTER badge shown for Girma', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page.getByText('DUPLICATE CLUSTER').first()).toBeVisible();
  });

  test('credential chip (MSISDN) is visible on persona card and input buffer height >= 48px', async ({ page }) => {
    await page.goto('/simulator');
    await expect(page.getByText(/MSISDN:\s*\+251999000003/).first()).toBeVisible();
    const box = await page.getByTestId('text-input').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });
});

// ─── API Integration — REAL backend ───────────────────────────────────────────

test.describe('real POST /api/ussd integration', () => {
  test('dialling *890# sends a real request to /api/ussd and shows backend response in transcript', async ({
    page,
  }) => {
    // Intercept to observe (but NOT mock) the request
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ussd')) {
        requests.push(req.url());
      }
    });

    await page.goto('/simulator');

    // Dial — this must hit the real /api/ussd route
    await page.getByTestId('btn-dial').click();

    // Wait for the transcript to update with the backend response
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // At least one real request was made to /api/ussd
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.some((u) => u.includes('/api/ussd'))).toBe(true);
  });

  test('backend response text appears in the LCD display', async ({ page }) => {
    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();

    // LCD must update from initial idle text to the backend response
    const lcd = page.getByTestId('lcd-display');
    // The root menu should appear (it renders a menu with options like "1.")
    await expect(lcd).toContainText('1', { timeout: 10000 });
  });

  test('raw backend response is displayed verbatim in transcript', async ({ page }) => {
    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();

    // Real USSD backend always starts with CON or END; wait for response
    await expect(page.getByTestId('raw-response')).toHaveText(/^(CON|END)/, { timeout: 10000 });
  });

  test('pressing a digit key sends a request to /api/ussd with cumulative text', async ({
    page,
  }) => {
    const requests: { url: string; body: string }[] = [];
    page.on('request', async (req) => {
      if (req.url().includes('/api/ussd') && req.method() === 'POST') {
        const body = req.postData() || '';
        requests.push({ url: req.url(), body });
      }
    });

    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();

    // Wait for initial response
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // Press '1' (select option 1 - Check Project)
    await page.getByTestId('key-1').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-direction="received"]').length >= 2,
      { timeout: 10000 }
    );

    // The second request should have text="1" in the body
    const secondRequest = requests.find((r) => {
      try {
        const parsed = JSON.parse(r.body);
        return parsed.text === '1';
      } catch {
        return false;
      }
    });
    expect(secondRequest).toBeTruthy();
  });
});

// ─── Persona Selection ────────────────────────────────────────────────────────

test.describe('persona selection', () => {
  test('persona selector shows which persona is active', async ({ page }) => {
    await page.goto('/simulator');

    // First persona (Amina) should be selected by default — its button has aria-pressed=true
    const aminaButton = page.getByRole('button', {
      name: /Amina \(Cluster Gamma - Demo Phone 1\)/i,
    });
    await expect(aminaButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('switching persona resets session state and updates phone number in LCD', async ({
    page,
  }) => {
    await page.goto('/simulator');

    // Start with Amina, dial
    await page.getByTestId('btn-dial').click();
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // Switch to Girma (Colliding Neighbor)
    await page.getByRole('button', { name: /Girma/i }).click();

    // Session should be reset to IDLE
    await expect(page.getByTestId('session-state')).toContainText('IDLE');

    // Phone number in LCD status bar should now show Girma's number
    await expect(page.getByTestId('phone-number')).toContainText('251999000004');
  });
});

// ─── Adversarial input ────────────────────────────────────────────────────────

test.describe('adversarial input handling', () => {
  test('pressing keys when session is not started does nothing (no request sent)', async ({
    page,
  }) => {
    const ussdRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ussd')) ussdRequests.push(req.url());
    });

    await page.goto('/simulator');

    // Keys are disabled before session start — clicking must not trigger a request
    await page.getByTestId('key-1').click({ force: true });
    await page.waitForTimeout(500);

    // Should not have sent any /api/ussd request
    expect(ussdRequests).toHaveLength(0);
  });

  test('invalid single-digit input is handled by backend, not client-side logic', async ({
    page,
  }) => {
    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // Send '9' which is an invalid root menu option
    await page.getByTestId('key-9').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 2,
      { timeout: 10000 }
    );

    // Backend returns an invalid-hint response (CON with same menu + hint)
    const rawResponse = await page.getByTestId('raw-response').textContent();
    expect(rawResponse?.trim()).toMatch(/^CON/); // Session remains alive (CON, not END)
  });

  test('Back (0) button sends 0 to the backend', async ({ page }) => {
    const bodies: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ussd') && req.method() === 'POST') {
        bodies.push(req.postData() || '');
      }
    });

    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // Navigate to check project
    await page.getByTestId('key-1').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 2,
      { timeout: 10000 }
    );

    // Press Back
    await page.getByTestId('btn-back').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 3,
      { timeout: 10000 }
    );

    // Last request body should contain text ending with *0
    const lastBody = bodies[bodies.length - 1];
    const parsed = JSON.parse(lastBody);
    expect(parsed.text).toMatch(/\*0$|^0$/);
  });

  test('Home (00) button sends 00 to the backend', async ({ page }) => {
    const bodies: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ussd') && req.method() === 'POST') {
        bodies.push(req.postData() || '');
      }
    });

    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    await page.getByTestId('key-1').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 2,
      { timeout: 10000 }
    );

    await page.getByTestId('btn-home').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 3,
      { timeout: 10000 }
    );

    const lastBody = bodies[bodies.length - 1];
    const parsed = JSON.parse(lastBody);
    expect(parsed.text).toMatch(/\*00$|^00$/);
  });

  test('text input field sends entered value on Enter press', async ({ page }) => {
    const bodies: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ussd') && req.method() === 'POST') {
        bodies.push(req.postData() || '');
      }
    });

    await page.goto('/simulator');
    await page.getByTestId('btn-dial').click();
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // Navigate to project code input
    await page.getByTestId('key-1').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 2,
      { timeout: 10000 }
    );

    // Type project code via text input
    await page.getByTestId('text-input').fill('4412');
    await page.getByTestId('text-input').press('Enter');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-direction="received"]').length >= 3,
      { timeout: 10000 }
    );

    const lastBody = bodies[bodies.length - 1];
    const parsed = JSON.parse(lastBody);
    expect(parsed.text).toContain('4412');
  });
});

// ─── Checkpoint 2 Duplicate/Same-Cluster Demo ─────────────────────────────────

test.describe('Checkpoint 2 — duplicate cluster demo flow', () => {
  test('switching to Girma (duplicate persona) after Amina shows same cluster key', async ({
    page,
  }) => {
    await page.goto('/simulator');

    // Verify Amina is selected first
    await expect(page.getByRole('button', { name: /Amina/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // Both Amina and Girma cluster keys appear on the persona section
    // The section has aria-label="Persona selector"
    const personaSection = page.getByLabel('Persona selector');
    await expect(personaSection).toBeVisible();

    // Switch to Girma
    await page.getByRole('button', { name: /Girma/i }).click();
    await expect(page.getByRole('button', { name: /Girma/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // The cluster key shown in the persona section footer should be visible
    await expect(personaSection.getByText(/Cluster key:/)).toBeVisible();
  });

  test('DUPLICATE CLUSTER badge is clearly visible for the Girma persona', async ({ page }) => {
    await page.goto('/simulator');

    // Navigate to Girma's button — it must show the DUPLICATE CLUSTER badge
    const girmaCard = page.getByRole('button', { name: /Girma/i });
    await expect(girmaCard.getByText('DUPLICATE CLUSTER')).toBeVisible();
  });

  test('Amina completes observation 3/3, then Girma dials and receives duplicate suppression', async ({ page }) => {
    await page.goto('/simulator');

    // Helper to send a keypress and wait for backend reply
    async function sendKey(key: string) {
      const prevCount = await page.locator('[data-direction="received"]').count();
      await page.getByTestId(`key-${key}`).click();
      await page.waitForFunction(
        (target) => document.querySelectorAll('[data-direction="received"]').length > target,
        prevCount,
        { timeout: 10000 }
      );
    }

    // 1. Dial as Amina
    await page.getByRole('button', { name: /Amina/i }).click();
    await page.getByTestId('btn-dial').click();
    await page.waitForSelector('[data-direction="received"]', { timeout: 10000 });

    // Step: Select Check Project (1)
    await sendKey('1');
    // Step: Enter project code 4412 via text input
    await page.getByTestId('text-input').fill('4412');
    const countBefore4412 = await page.locator('[data-direction="received"]').count();
    await page.getByTestId('text-input').press('Enter');
    await page.waitForFunction(
      (target) => document.querySelectorAll('[data-direction="received"]').length > target,
      countBefore4412,
      { timeout: 10000 }
    );

    // Step: Check this project (1)
    await sendKey('1');
    // Step: Q1 runs_on_outage -> Yes (1)
    await sendKey('1');
    // Step: Q2 fridge_green -> Yes (1)
    await sendKey('1');
    // Step: Q3 board_posted -> Yes (1)
    await sendKey('1');

    // Amina terminal response should be counted
    await expect(page.getByTestId('raw-response')).toContainText('Thank you. 3 of 3 neighbours have checked.');

    // 2. Switch to Girma (same cluster duplicate)
    await page.getByRole('button', { name: /Girma/i }).click();
    await page.getByTestId('btn-dial').click();
    await page.waitForFunction(
      () => {
        const lines = Array.from(document.querySelectorAll('[data-direction="received"]'));
        return lines.length > 0 && lines[lines.length - 1].textContent?.includes('CON');
      },
      { timeout: 10000 }
    );

    // Step: Select Check Project (1)
    await sendKey('1');
    // Step: Enter project code 4412
    await page.getByTestId('text-input').fill('4412');
    const countBeforeGirma4412 = await page.locator('[data-direction="received"]').count();
    await page.getByTestId('text-input').press('Enter');
    await page.waitForFunction(
      (target) => document.querySelectorAll('[data-direction="received"]').length > target,
      countBeforeGirma4412,
      { timeout: 10000 }
    );

    // Step: Check this project (1)
    await sendKey('1');
    // Step: Q1 -> Yes (1)
    await sendKey('1');
    // Step: Q2 -> Yes (1)
    await sendKey('1');
    // Step: Q3 -> Yes (1)
    await sendKey('1');

    // Girma terminal response MUST be duplicate suppression!
    await expect(page.getByTestId('raw-response')).toContainText('This area has already been counted, so the total stays at 3.');
  });
});
