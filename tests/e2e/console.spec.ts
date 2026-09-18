// Operator Console — E2E Tests (T-22)
// Authoritative sources:
// - docs/specs/11-tasks.md T-22 (shows fiscal/audit state, witness n/target, probation countdown; recording claim visibly does NOT turn green)
// - docs/specs/08-ui-ux-design.md §7 (Dense table, sortable, plain system tool, no cards)
// - docs/specs/12-demo-script.md §4 (Demo moment 0:44-0:56)
// - docs/specs/04-state-machine.md §3, §7 (INV-01)

import { test, expect } from '@playwright/test';

test.describe('T-22: Operator Console — Project Board & Repair Claim', () => {
  // Serial mode: this suite mutates shared in-memory project state (demo-reset-btn,
  // claim submission, early-close attempt). Parallel execution causes workers to
  // race on that state and produces flaky modal-visibility failures.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/console');
  });

  test('loads console page with title, municipal header, and navigation', async ({ page }) => {
    await expect(page).toHaveTitle(/Operator Console/);
    await expect(page.getByText('Ward Proof-Line // Municipal Operator Interface')).toBeVisible();
    await expect(page.getByText(/CONSOLE: WOREDA 0?9/i)).toBeVisible();
    await expect(page.getByText('Role: ADMIN')).toBeVisible();
    await expect(page.getByText('Audit Chain: Genesis-linked')).toBeVisible();
  });

  test('renders all 6 canonical demo projects in the dense table', async ({ page }) => {
    for (const code of ['4412', '4413', '4414', '4415', '4416', '4417']) {
      await expect(page.getByTestId(`project-row-${code}`)).toBeVisible();
    }
  });

  test('displays fiscal state, audit state, and witness counter for projects', async ({ page }) => {
    const row4412 = page.getByTestId('project-row-4412');
    await expect(row4412.getByTestId('state-badge-fiscal-COMMITTED')).toBeVisible();
    await expect(row4412.getByTestId('state-badge-audit-AWAITING_THRESHOLD')).toBeVisible();
    await expect(row4412.getByTestId('witness-counter')).toContainText('2of3');

    const row4413 = page.getByTestId('project-row-4413');
    await expect(row4413.getByTestId('state-badge-fiscal-AUDITED')).toBeVisible();
    await expect(row4413.getByTestId('state-badge-audit-PHYSICALLY_CONFIRMED')).toBeVisible();
    await expect(row4413.getByTestId('witness-counter')).toContainText('3of3');

    const row4415 = page.getByTestId('project-row-4415');
    await expect(row4415.getByTestId('state-badge-audit-DISCREPANCY_FLAGGED')).toBeVisible();
  });

  test('supports filtering projects by status', async ({ page }) => {
    // Filter by Discrepancy
    await page.getByTestId('filter-discrepancy').click();
    await expect(page.getByTestId('project-row-4415')).toBeVisible();
    await expect(page.getByTestId('project-row-4413')).not.toBeVisible();

    // Restore All
    await page.getByTestId('filter-all').click();
    await expect(page.getByTestId('project-row-4412')).toBeVisible();
    await expect(page.getByTestId('project-row-4413')).toBeVisible();
  });

  test('supports searching by project code or contractor', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search code / title...');
    await searchInput.fill('Abyssinia');
    await expect(page.getByTestId('project-row-4413')).toBeVisible();
    await expect(page.getByTestId('project-row-4412')).not.toBeVisible();

    await page.getByText('Clear').click();
    await expect(page.getByTestId('project-row-4412')).toBeVisible();
  });

  // ==========================================================================
  // KEY ACCEPTANCE TEST: T-22 & Demo Moment 0:44-0:56
  // Recording a claim visibly does NOT turn the project green (INV-01)
  // ==========================================================================
  test('T-22 Acceptance: recording repair claim visibly does NOT turn project green (INV-01)', async ({
    page,
  }) => {
    // 1. Simulate breakage on 4412 using demo helper button
    await page.getByTestId('demo-reset-btn').click();
    await expect(page.getByTestId('countdown-broken')).toBeVisible();

    // 2. Click Record Claim button
    const claimBtn = page.getByTestId('claim-btn-4412');
    await expect(claimBtn).toBeVisible();
    await claimBtn.click();

    // 3. Modal opens with contractor name and INV-01 warning
    const modal = page.getByTestId('claim-repair-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('INVARIANT INV-01');
    await expect(modal).toContainText('will NOT turn the project green');

    // 4. Submit claim
    const contractorInput = page.getByTestId('claim-contractor-input');
    await expect(contractorInput).toHaveValue('AfroTech Infra');
    await page.getByTestId('claim-submit-btn').click();

    // 5. Modal closes and banner appears
    await expect(modal).not.toBeVisible();
    const banner = page.getByTestId('console-alert-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Under 7-Day Probation Lock');
    await expect(banner).toContainText('The contractor says it is fixed: that is a claim, not a fact');

    // 6. VERIFY ROW STATE — INV-01 ENFORCEMENT:
    // Row 4412 must display REPAIR_CLAIMED in amber, countdown active, NEVER green sustained
    const row4412 = page.getByTestId('project-row-4412');
    const countdown = row4412.getByTestId('countdown-probation');
    await expect(countdown).toBeVisible();
    await expect(countdown).toContainText(/7d left|6d left/);

    // State badge must be REPAIR_CLAIMED (amber)
    const claimedBadge = row4412.getByTestId('state-badge-probation-REPAIR_CLAIMED');
    await expect(claimedBadge).toBeVisible();

    // CRITICAL: MUST NOT have green sustained badge
    await expect(row4412.getByTestId('countdown-sustained')).not.toBeVisible();
    await expect(row4412.getByText('✓ Sustained')).not.toBeVisible();

    // 7. Early close attempt is refused with 409
    const closeBtn = row4412.getByTestId('attempt-close-btn-4412');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Error banner confirms 409 E_PROBATION_LOCKED
    await expect(page.getByTestId('console-alert-banner')).toContainText('409 E_PROBATION_LOCKED');
  });

  test('/console/probation route alias works correctly', async ({ page }) => {
    await page.goto('/console/probation');
    await expect(page).toHaveTitle(/Operator Console/);
    await expect(page.getByTestId('project-row-4412')).toBeVisible();
  });
});
