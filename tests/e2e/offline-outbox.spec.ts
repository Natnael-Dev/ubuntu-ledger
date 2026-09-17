// Playwright E2E Test: T-29 Offline Observation Outbox & Sync
// Authoritative sources: docs/specs/08-ui-ux-design.md §4, docs/specs/11-tasks.md T-29, docs/specs/14-testing-and-edge-cases.md ADV-28

import { test, expect } from '@playwright/test';

test.describe('T-29: Monitor PWA — Offline Outbox & Reconnection Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pwa');
    // Clear outbox queue before each test to start clean
    const clearBtn = page.getByTestId('btn-clear-outbox');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    }
  });

  test('loads PWA page with SyncBadge showing Online state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Monitor Field Observation/i })).toBeVisible();
    const badge = page.getByTestId('sync-badge');
    await expect(badge).toBeVisible();
    await expect(page.getByTestId('sync-status')).toHaveText('Online');
    await expect(page.getByTestId('sync-count')).toHaveText('(All synced)');
  });

  test('records observation offline, shows queued badge, and auto-syncs on reconnect', async ({ page }) => {
    // 1. Turn ON Airplane Mode
    const airplaneBtn = page.getByTestId('airplane-mode-toggle');
    await airplaneBtn.click();
    await expect(airplaneBtn).toContainText('Airplane Mode: ON');

    // Verify badge updates to Offline
    await expect(page.getByTestId('sync-status')).toHaveText('Offline');

    // 2. Submit observation while offline
    await page.getByTestId('btn-submit-observation').click();

    // Verify submission notice
    const notice = page.getByTestId('submission-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/saved locally in offline outbox/i);

    // Verify badge shows Offline (1 queued)
    await expect(page.getByTestId('sync-status')).toHaveText('Offline');
    await expect(page.getByTestId('sync-count')).toHaveText('(1 queued)');

    // Verify outbox table displays item with status QUEUED
    const table = page.getByTestId('outbox-table');
    await expect(table).toBeVisible();
    const itemStatus = table.getByTestId('item-status').first();
    await expect(itemStatus).toHaveText('QUEUED');

    // 3. Turn OFF Airplane Mode (reconnect)
    await airplaneBtn.click();
    await expect(airplaneBtn).toContainText('Airplane Mode: OFF');

    // Trigger sync
    await page.getByTestId('btn-sync-now').click();

    // Verify badge updates to Online (All synced)
    await expect(page.getByTestId('sync-status')).toHaveText('Online');
    await expect(page.getByTestId('sync-count')).toHaveText('(All synced)');

    // Verify table item transitioned to SYNCED
    await expect(itemStatus).toHaveText('SYNCED');

    // 4. Duplicate replay test: clicking Sync Now again remains clean
    await page.getByTestId('btn-sync-now').click();
    await expect(page.getByTestId('sync-status')).toHaveText('Online');
    await expect(page.getByTestId('sync-count')).toHaveText('(All synced)');
  });
});
